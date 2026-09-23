const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const http = require('http');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'terminal-site-logs';
const GUESTBOOK_TABLE = process.env.GUESTBOOK_TABLE || 'terminal-site-guestbook';
const TOKEN_SECRET = process.env.TOKEN_SECRET;

// In-memory geolocation cache (survives while the Lambda container is warm).
// Persistent copies are stored in the logs table as type 'geo' items.
const geoCache = {};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyToken(token) {
    if (!token) return { valid: false, error: 'No token provided' };

    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, error: 'Invalid token format' };

    const [payloadBase64, signature] = parts;

    const expectedSignature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(payloadBase64)
        .digest('base64url');

    if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
    }

    try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
        if (Date.now() > payload.exp) {
            return { valid: false, error: 'Token expired' };
        }
        return { valid: true, payload };
    } catch {
        return { valid: false, error: 'Invalid payload' };
    }
}

// ---------------------------------------------------------------------------
// DynamoDB helpers
// ---------------------------------------------------------------------------

// Scan the whole table, following pagination. DynamoDB applies `Limit` BEFORE
// the filter expression, so the old code silently dropped rows once the table
// passed the limit. Never pass Limit here.
async function scanAll(params) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const result = await docClient.send(new ScanCommand({ ...params, ExclusiveStartKey }));
        items.push(...(result.Items || []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

async function queryAll(params) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const result = await docClient.send(new QueryCommand({ ...params, ExclusiveStartKey }));
        items.push(...(result.Items || []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

// All log events (excludes the persisted geo records)
async function scanEvents(extraParams = {}) {
    const items = await scanAll({ TableName: TABLE_NAME, ...extraParams });
    return items.filter(i => i.type !== 'geo');
}

// ---------------------------------------------------------------------------
// Geolocation (ip-api.com, batch endpoint: 100 IPs per request, 15 req/min)
// ---------------------------------------------------------------------------

const GEO_FIELDS = 'status,message,country,countryCode,regionName,city,isp,org,as,proxy,hosting,query';

function isPublicIp(ip) {
    if (!ip || typeof ip !== 'string') return false;
    if (ip === 'unknown' || ip === '#unknown-user' || ip === '127.0.0.1' || ip === '::1') return false;
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) return false;
    return true;
}

function normaliseGeo(geo) {
    return {
        country: geo.country || 'Unknown',
        countryCode: geo.countryCode || '',
        city: geo.city || '',
        region: geo.regionName || geo.region || '',
        isp: geo.isp || '',
        org: geo.org || '',
        as: geo.as || '',
        proxy: !!geo.proxy,
        hosting: !!geo.hosting
    };
}

function postJson(url, body) {
    return new Promise((resolve) => {
        const data = JSON.stringify(body);
        const req = http.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
            timeout: 8000
        }, (res) => {
            let out = '';
            res.on('data', chunk => out += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(out)); } catch (e) { console.log('Geo parse error:', e.message, out.slice(0, 200)); resolve(null); }
            });
        });
        req.on('error', (e) => { console.log('Geo request error:', e.message); resolve(null); });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(data);
        req.end();
    });
}

async function lookupGeoBatch(ips) {
    const results = {};
    for (let i = 0; i < ips.length; i += 100) {
        const chunk = ips.slice(i, i + 100);
        const response = await postJson(`http://ip-api.com/batch?fields=${GEO_FIELDS}`, chunk);
        if (!Array.isArray(response)) break;
        response.forEach(geo => {
            if (geo && geo.status === 'success' && geo.query) {
                results[geo.query] = normaliseGeo(geo);
            } else if (geo && geo.query) {
                console.log('Geo lookup failed for', geo.query, geo.message);
            }
        });
    }
    return results;
}

async function persistGeo(ip, location) {
    try {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: `geo#${ip}`,
                sk: 'geo',
                type: 'geo',
                ip,
                location,
                timestamp: new Date().toISOString()
            }
        }));
    } catch (e) {
        console.log('Failed to persist geo for', ip, e.message);
    }
}

// Resolve locations for a set of IPs. Order of preference:
//   1. warm cache, 2. persisted geo items, 3. location stored on terminal visit
//   events, 4. ip-api batch lookup (result is persisted for next time).
async function resolveGeo(ips, allItems) {
    const result = {};
    const missing = [];

    const persisted = {};
    allItems.forEach(item => {
        if (item.type === 'geo' && item.ip && item.location) persisted[item.ip] = item.location;
    });
    const stored = {};
    allItems.forEach(item => {
        if (item.type !== 'geo' && item.location && item.ip && !stored[item.ip]) stored[item.ip] = normaliseGeo(item.location);
    });

    ips.forEach(ip => {
        if (!isPublicIp(ip)) return;
        if (geoCache[ip]) result[ip] = geoCache[ip];
        else if (persisted[ip]) { result[ip] = persisted[ip]; geoCache[ip] = persisted[ip]; }
        else missing.push(ip);
    });

    if (missing.length > 0) {
        const looked = await lookupGeoBatch(missing);
        for (const ip of missing) {
            const loc = looked[ip] || stored[ip] || null;
            if (loc) {
                result[ip] = loc;
                geoCache[ip] = loc;
                await persistGeo(ip, loc);
            }
        }
    }
    return result;
}

// Backwards-compatible single lookup used by the legacy endpoints
async function getGeoLocation(ip) {
    if (!isPublicIp(ip)) return null;
    if (geoCache[ip]) return geoCache[ip];
    const looked = await lookupGeoBatch([ip]);
    if (looked[ip]) {
        geoCache[ip] = looked[ip];
        await persistGeo(ip, looked[ip]);
        return looked[ip];
    }
    return null;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

function ok(body) {
    return { statusCode: 200, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const authHeader = event.headers?.['authorization'] || event.headers?.['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authorization required' }) };
    }

    const tokenResult = verifyToken(authHeader.substring(7));
    if (!tokenResult.valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: tokenResult.error }) };
    }

    try {
        const path = event.path || event.rawPath || '';
        const queryParams = event.queryStringParameters || {};

        if (path.includes('/dashboard')) {
            return await getDashboard();
        } else if (path.includes('/win-chats')) {
            return await getWinChats(queryParams);
        } else if (path.includes('/win-stats')) {
            return await getWinStats();
        } else if (path.includes('/stats')) {
            return await getStats();
        } else if (path.includes('/visitor-activity')) {
            return await getVisitorActivity(queryParams);
        } else if (path.includes('/visitors')) {
            return await getVisitors();
        } else if (path.includes('/visits')) {
            return await getVisits(queryParams);
        } else if (path.includes('/commands')) {
            return await getCommands(queryParams);
        } else if (path.includes('/chats')) {
            return await getChats(queryParams);
        } else if (path.includes('/all')) {
            return await getAllData(queryParams);
        } else {
            return await getStats();
        }
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};

// ---------------------------------------------------------------------------
// /dashboard — everything the dashboard needs in one call
// ---------------------------------------------------------------------------

const WIN_TYPES = new Set(['win-visit', 'win-click', 'win-window', 'win-chat', 'win-cv', 'win-session']);

function toNumber(value) {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function normaliseEvent(item) {
    const base = {
        id: item.pk,
        ts: item.timestamp,
        ip: isPublicIp(item.ip) ? item.ip : 'unknown',
        site: WIN_TYPES.has(item.type) ? 'win95' : 'terminal',
        type: item.type,
        sessionId: item.sessionId || undefined
    };
    switch (item.type) {
        case 'visit':
            return { ...base, userAgent: item.userAgent || undefined };
        case 'command':
            return { ...base, command: item.command ?? '' };
        case 'chat':
        case 'win-chat':
            return { ...base, userMessage: item.userMessage ?? '', botResponse: item.botResponse ?? '' };
        case 'win-visit':
            return {
                ...base,
                userAgent: item.userAgent || undefined,
                referrer: item.referrer || undefined,
                screenWidth: toNumber(item.screenWidth),
                screenHeight: toNumber(item.screenHeight)
            };
        case 'win-click':
            return { ...base, element: item.element || 'unknown', target: item.target || item.action || '' };
        case 'win-window':
            return { ...base, appName: item.appName || 'unknown', action: item.action || '' };
        case 'win-cv':
            return { ...base, action: item.action || '', pageNumber: toNumber(item.pageNumber) };
        case 'win-session':
            return { ...base, durationMs: toNumber(item.durationMs) ?? toNumber(item.duration) ?? 0 };
        default:
            return base;
    }
}

async function getGuestbook() {
    try {
        const entries = await queryAll({
            TableName: GUESTBOOK_TABLE,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': 'entry' }
        });
        let visitorCount = 0;
        try {
            const counter = await queryAll({
                TableName: GUESTBOOK_TABLE,
                KeyConditionExpression: 'pk = :pk AND sk = :sk',
                ExpressionAttributeValues: { ':pk': 'counter', ':sk': 'visitors' }
            });
            visitorCount = toNumber(counter[0]?.count) ?? 0;
        } catch (e) {
            console.log('Guestbook counter read failed:', e.message);
        }
        return {
            visitorCount,
            entries: entries
                .map(e => ({
                    id: e.id,
                    name: e.name ?? '',
                    message: e.message ?? '',
                    ts: e.timestamp || e.sk,
                    ip: isPublicIp(e.ip) ? e.ip : 'unknown',
                    approved: e.approved !== false,
                    // The 90s-style seed entries were written by hand, not by visitors
                    seed: typeof e.id === 'string' && e.id.startsWith('90s-entry-')
                }))
                .sort((a, b) => new Date(b.ts) - new Date(a.ts))
        };
    } catch (e) {
        console.log('Guestbook read failed:', e.message);
        return { visitorCount: 0, entries: [], error: e.message };
    }
}

async function getDashboard() {
    const [allItems, guestbook] = await Promise.all([
        scanAll({ TableName: TABLE_NAME }),
        getGuestbook()
    ]);

    const rawEvents = allItems.filter(i => i.type !== 'geo' && i.timestamp);

    // The terminal logs each chat message twice: as a chat record and as a
    // command "[chat] …". Keep only the chat record.
    const filtered = rawEvents.filter(i => !(i.type === 'command' && typeof i.command === 'string' && i.command.startsWith('[chat]')));

    // The Win95 site fires the session-end event more than once per session.
    // Keep one win-session per sessionId, with the longest duration.
    const sessionEnds = {};
    const events = [];
    filtered.forEach(item => {
        if (item.type === 'win-session' && item.sessionId) {
            const existing = sessionEnds[item.sessionId];
            const duration = toNumber(item.durationMs) ?? 0;
            if (!existing || duration > (toNumber(existing.durationMs) ?? 0)) sessionEnds[item.sessionId] = item;
            return;
        }
        events.push(normaliseEvent(item));
    });
    Object.values(sessionEnds).forEach(item => events.push(normaliseEvent(item)));

    events.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    const ips = new Set();
    events.forEach(e => { if (e.ip !== 'unknown') ips.add(e.ip); });
    guestbook.entries.forEach(e => { if (e.ip !== 'unknown') ips.add(e.ip); });

    const geo = await resolveGeo([...ips], allItems);

    return ok({
        generatedAt: new Date().toISOString(),
        totalRawItems: rawEvents.length,
        events,
        geo,
        guestbook
    });
}

// ---------------------------------------------------------------------------
// Legacy endpoints (kept for compatibility; now read the whole table)
// ---------------------------------------------------------------------------

async function getAllData(params) {
    const limit = parseInt(params.limit) || 1000;
    const items = await scanEvents();
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return ok({ total: items.length, items: items.slice(0, limit) });
}

async function getStats() {
    const items = await scanEvents();

    const visits = items.filter(i => i.type === 'visit');
    const commands = items.filter(i => i.type === 'command' && !(typeof i.command === 'string' && i.command.startsWith('[chat]')));
    const chats = items.filter(i => i.type === 'chat');

    const uniqueIPs = new Set(items.map(i => i.ip).filter(isPublicIp));

    const commandFreq = {};
    commands.forEach(c => {
        const cmd = c.command || 'unknown';
        commandFreq[cmd] = (commandFreq[cmd] || 0) + 1;
    });
    const topCommands = Object.entries(commandFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    const sessions = new Set(chats.map(c => c.sessionId).filter(Boolean));

    const hourlyActivity = {};
    items.forEach(i => {
        if (i.timestamp) {
            const hour = new Date(i.timestamp).getUTCHours();
            hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        }
    });

    const dailyActivity = {};
    items.forEach(i => {
        if (i.timestamp) {
            const day = i.timestamp.split('T')[0];
            dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        }
    });
    const dailyData = Object.entries(dailyActivity)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

    return ok({
        overview: {
            totalEvents: items.length,
            totalVisits: visits.length,
            totalCommands: commands.length,
            totalChats: chats.length,
            uniqueVisitors: uniqueIPs.size,
            chatSessions: sessions.size
        },
        topCommands,
        hourlyActivity: Object.entries(hourlyActivity)
            .map(([hour, count]) => ({ hour: parseInt(hour), count }))
            .sort((a, b) => a.hour - b.hour),
        dailyActivity: dailyData
    });
}

async function getVisits(params) {
    const limit = parseInt(params.limit) || 100;
    const items = await scanEvents({
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':type': 'visit' }
    });
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return ok({ visits: items.slice(0, limit) });
}

async function getCommands(params) {
    const limit = parseInt(params.limit) || 100;
    const items = await scanEvents({
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':type': 'command' }
    });
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return ok({ commands: items.slice(0, limit) });
}

function groupChatSessions(items) {
    items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const sessionMap = {};
    items.forEach(chat => {
        const sid = chat.sessionId || 'unknown';
        if (!sessionMap[sid]) {
            sessionMap[sid] = { sessionId: sid, ip: chat.ip, startTime: chat.timestamp, messages: [] };
        }
        sessionMap[sid].messages.push({
            userMessage: chat.userMessage,
            botResponse: chat.botResponse,
            timestamp: chat.timestamp
        });
        sessionMap[sid].endTime = chat.timestamp;
    });
    return Object.values(sessionMap).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

async function getChats(params) {
    const limit = parseInt(params.limit) || 100;
    const sessionId = params.sessionId;

    let filterExpression = '#type = :type';
    const expressionAttributeValues = { ':type': 'chat' };
    if (sessionId) {
        filterExpression += ' AND sessionId = :sessionId';
        expressionAttributeValues[':sessionId'] = sessionId;
    }

    const items = await scanEvents({
        FilterExpression: filterExpression,
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: expressionAttributeValues
    });
    const sessions = groupChatSessions(items).slice(0, limit);
    return ok({ totalChats: items.length, sessions });
}

async function getWinChats(params) {
    const limit = parseInt(params.limit) || 100;
    const allItems = await scanAll({ TableName: TABLE_NAME });
    const items = allItems.filter(i => i.type === 'win-chat');
    const sessions = groupChatSessions(items).slice(0, limit);
    const geo = await resolveGeo(sessions.map(s => s.ip), allItems);
    sessions.forEach(session => { session.location = geo[session.ip] || null; });
    return ok({ totalChats: items.length, sessions });
}

async function getVisitorActivity(params) {
    const ip = params.ip;
    if (!ip) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'IP address required' }) };
    }

    const allItems = await scanAll({ TableName: TABLE_NAME });
    const items = allItems.filter(i => i.type !== 'geo' && i.ip === ip);
    items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const geo = await resolveGeo([ip], allItems);
    const location = geo[ip] || null;

    const sessions = [];
    let currentSession = null;
    const SESSION_GAP_MS = 30 * 60 * 1000;

    items.forEach(item => {
        const itemTime = new Date(item.timestamp).getTime();
        if (!currentSession || (itemTime - currentSession.lastEventTime) > SESSION_GAP_MS) {
            currentSession = { startTime: item.timestamp, endTime: item.timestamp, lastEventTime: itemTime, events: [] };
            sessions.push(currentSession);
        }
        currentSession.events.push({
            type: item.type,
            timestamp: item.timestamp,
            ...(item.type === 'command' && { command: item.command }),
            ...(item.type === 'chat' && { userMessage: item.userMessage, botResponse: item.botResponse, sessionId: item.sessionId }),
            ...(item.type === 'visit' && { userAgent: item.userAgent })
        });
        currentSession.endTime = item.timestamp;
        currentSession.lastEventTime = itemTime;
    });

    sessions.forEach(session => {
        delete session.lastEventTime;
        session.totalEvents = session.events.length;
        session.visits = session.events.filter(e => e.type === 'visit').length;
        session.commands = session.events.filter(e => e.type === 'command').length;
        session.chats = session.events.filter(e => e.type === 'chat').length;
    });

    return ok({ ip, location, totalEvents: items.length, totalSessions: sessions.length, sessions: sessions.reverse() });
}

async function getVisitors() {
    const allItems = await scanAll({ TableName: TABLE_NAME });
    const items = allItems.filter(i => i.type !== 'geo');

    const ipMap = {};
    items.forEach(item => {
        const ip = item.ip;
        if (!isPublicIp(ip)) return;
        if (!ipMap[ip]) {
            ipMap[ip] = { ip, firstSeen: item.timestamp, lastSeen: item.timestamp, totalEvents: 0, visits: 0, commands: 0, chats: 0 };
        }
        ipMap[ip].totalEvents++;
        if (item.type === 'visit') ipMap[ip].visits++;
        if (item.type === 'command') ipMap[ip].commands++;
        if (item.type === 'chat') ipMap[ip].chats++;
        if (new Date(item.timestamp) < new Date(ipMap[ip].firstSeen)) ipMap[ip].firstSeen = item.timestamp;
        if (new Date(item.timestamp) > new Date(ipMap[ip].lastSeen)) ipMap[ip].lastSeen = item.timestamp;
    });

    const visitors = Object.values(ipMap);
    const geo = await resolveGeo(visitors.map(v => v.ip), allItems);
    const visitorsWithGeo = visitors.map(visitor => ({ ...visitor, location: geo[visitor.ip] || null }));
    visitorsWithGeo.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

    return ok({ totalVisitors: visitorsWithGeo.length, visitors: visitorsWithGeo });
}

async function getWinStats() {
    const items = await scanEvents({
        FilterExpression: 'begins_with(#type, :prefix)',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':prefix': 'win-' }
    });

    const visits = items.filter(i => i.type === 'win-visit');
    const clicks = items.filter(i => i.type === 'win-click');
    const windows = items.filter(i => i.type === 'win-window');
    const chats = items.filter(i => i.type === 'win-chat');
    const cvEvents = items.filter(i => i.type === 'win-cv');

    // One session-end per sessionId (the site logs it more than once)
    const sessionMap = {};
    items.filter(i => i.type === 'win-session').forEach(s => {
        const d = toNumber(s.durationMs) ?? 0;
        const key = s.sessionId || s.pk;
        if (!sessionMap[key] || d > sessionMap[key]) sessionMap[key] = d;
    });
    const sessionDurations = Object.values(sessionMap);

    const uniqueIPs = new Set(items.map(i => i.ip).filter(isPublicIp));

    const clickFreq = {};
    clicks.forEach(c => {
        const key = c.target ? `${c.element || 'unknown'}:${c.target}` : (c.element || 'unknown');
        clickFreq[key] = (clickFreq[key] || 0) + 1;
    });
    const topClicks = Object.entries(clickFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

    const windowActions = {};
    windows.forEach(w => {
        const key = `${w.appName || 'unknown'}:${w.action || 'unknown'}`;
        windowActions[key] = (windowActions[key] || 0) + 1;
    });
    const topWindows = Object.entries(windowActions).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

    const cvOpened = cvEvents.filter(e => e.action === 'opened').length;
    const cvLoaded = cvEvents.filter(e => e.action === 'loaded').length;
    const cvPageChanges = cvEvents.filter(e => e.action === 'page-change').length;
    const cvDownloaded = cvEvents.filter(e => e.action === 'downloaded').length;

    const chatSessions = new Set(chats.map(c => c.sessionId).filter(Boolean));

    const avgDurationMs = sessionDurations.length > 0
        ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
        : 0;

    const hourlyActivity = {};
    items.forEach(i => {
        if (i.timestamp) {
            const hour = new Date(i.timestamp).getUTCHours();
            hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        }
    });

    const dailyActivity = {};
    items.forEach(i => {
        if (i.timestamp) {
            const day = i.timestamp.split('T')[0];
            dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        }
    });
    const dailyData = Object.entries(dailyActivity).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));

    return ok({
        overview: {
            totalEvents: items.length,
            totalVisits: visits.length,
            totalClicks: clicks.length,
            totalWindows: windows.length,
            totalChats: chats.length,
            totalCVViews: cvEvents.length,
            totalSessions: sessionDurations.length,
            uniqueVisitors: uniqueIPs.size,
            chatSessions: chatSessions.size,
            avgSessionDuration: Math.round(avgDurationMs / 1000)
        },
        topClicks,
        topWindows,
        cvFunnel: { opened: cvOpened, loaded: cvLoaded, pageChanges: cvPageChanges, downloaded: cvDownloaded },
        hourlyActivity: Object.entries(hourlyActivity).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour),
        dailyActivity: dailyData
    });
}
