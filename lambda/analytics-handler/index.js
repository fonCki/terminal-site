const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'terminal-site-logs';
const TOKEN_SECRET = process.env.TOKEN_SECRET;

// Cache for IP geolocation to avoid repeated API calls
const geoCache = {};

// Token verification function
function verifyToken(token) {
    if (!token) return { valid: false, error: 'No token provided' };

    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, error: 'Invalid token format' };

    const [payloadBase64, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(payloadBase64)
        .digest('base64url');

    if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
    }

    // Decode and check expiration
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

// Small delay helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getGeoLocation(ip) {
    if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return null; // Skip local/private IPs
    }
    if (geoCache[ip]) return geoCache[ip];

    return new Promise((resolve) => {
        https.get(`https://ipapi.co/${ip}/json/`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const geo = JSON.parse(data);
                    console.log('Geo API response for', ip, ':', JSON.stringify(geo));
                    if (geo.error || geo.reason) {
                        console.log('Geo API error:', geo.error || geo.reason);
                        resolve(null);
                    } else {
                        const result = {
                            country: geo.country_name || 'Unknown',
                            countryCode: geo.country_code || '',
                            city: geo.city || '',
                            region: geo.region || ''
                        };
                        geoCache[ip] = result;
                        resolve(result);
                    }
                } catch (e) {
                    console.log('Geo parse error:', e.message);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            console.log('Geo request error:', e.message);
            resolve(null);
        });
    });
}

// Fetch geolocations with rate limiting (1 request per 200ms)
async function getGeoLocationsThrottled(ips) {
    const results = {};
    for (const ip of ips) {
        results[ip] = await getGeoLocation(ip);
        if (!geoCache[ip]) {
            await delay(200); // Only delay if we made an API call
        }
    }
    return results;
}

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    // Handle CORS preflight (support both REST API and HTTP API formats)
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check for Bearer token authentication
    const authHeader = event.headers?.['authorization'] || event.headers?.['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authorization required' })
        };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const tokenResult = verifyToken(token);

    if (!tokenResult.valid) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: tokenResult.error })
        };
    }

    try {
        const path = event.path || event.rawPath || '';
        const queryParams = event.queryStringParameters || {};

        // Route based on path
        if (path.includes('/stats')) {
            return await getStats();
        } else if (path.includes('/visitor-activity')) {
            // Get all activity for a specific IP
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
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function getAllData(params) {
    const limit = parseInt(params.limit) || 1000;

    const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        Limit: limit
    }));

    const items = result.Items || [];

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            total: items.length,
            items
        })
    };
}

async function getStats() {
    // Scan all items to calculate stats
    const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME
    }));

    const items = result.Items || [];

    // Calculate stats
    const visits = items.filter(i => i.type === 'visit');
    const commands = items.filter(i => i.type === 'command');
    const chats = items.filter(i => i.type === 'chat');

    // Unique IPs - filter out empty/undefined/null values
    const uniqueIPs = new Set(items.map(i => i.ip).filter(ip => ip && ip !== 'unknown' && ip !== ''));

    // Command frequency
    const commandFreq = {};
    commands.forEach(c => {
        const cmd = c.command?.replace('[chat] ', '') || 'unknown';
        commandFreq[cmd] = (commandFreq[cmd] || 0) + 1;
    });

    // Sort commands by frequency
    const topCommands = Object.entries(commandFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    // Chat sessions
    const sessions = new Set(chats.map(c => c.sessionId).filter(Boolean));

    // Activity by hour
    const hourlyActivity = {};
    items.forEach(i => {
        if (i.timestamp) {
            const hour = new Date(i.timestamp).getHours();
            hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        }
    });

    // Activity by day
    const dailyActivity = {};
    items.forEach(i => {
        if (i.timestamp) {
            const day = i.timestamp.split('T')[0];
            dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        }
    });

    // Sort daily activity
    const dailyData = Object.entries(dailyActivity)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
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
        })
    };
}

async function getVisits(params) {
    const limit = parseInt(params.limit) || 100;

    const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':type': 'visit' },
        Limit: limit
    }));

    const items = (result.Items || [])
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ visits: items })
    };
}

async function getCommands(params) {
    const limit = parseInt(params.limit) || 100;

    const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':type': 'command' },
        Limit: limit
    }));

    const items = (result.Items || [])
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ commands: items })
    };
}

async function getChats(params) {
    const limit = parseInt(params.limit) || 100;
    const sessionId = params.sessionId;

    let filterExpression = '#type = :type';
    const expressionAttributeNames = { '#type': 'type' };
    const expressionAttributeValues = { ':type': 'chat' };

    if (sessionId) {
        filterExpression += ' AND sessionId = :sessionId';
        expressionAttributeValues[':sessionId'] = sessionId;
    }

    const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit
    }));

    const items = (result.Items || [])
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Group by session
    const sessionMap = {};
    items.forEach(chat => {
        const sid = chat.sessionId || 'unknown';
        if (!sessionMap[sid]) {
            sessionMap[sid] = {
                sessionId: sid,
                ip: chat.ip,
                startTime: chat.timestamp,
                messages: []
            };
        }
        sessionMap[sid].messages.push({
            userMessage: chat.userMessage,
            botResponse: chat.botResponse,
            timestamp: chat.timestamp
        });
        // Update end time
        sessionMap[sid].endTime = chat.timestamp;
    });

    const sessions = Object.values(sessionMap)
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            totalChats: items.length,
            sessions
        })
    };
}

async function getVisitorActivity(params) {
    const ip = params.ip;

    if (!ip) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'IP address required' })
        };
    }

    // Scan for all events from this IP
    const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'ip = :ip',
        ExpressionAttributeValues: { ':ip': ip }
    }));

    const items = result.Items || [];

    // Sort by timestamp (oldest first for timeline view)
    items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Try to get stored location from visit logs first
    let location = null;
    const visitWithLocation = items.find(item => item.location);
    if (visitWithLocation && visitWithLocation.location) {
        location = {
            country: visitWithLocation.location.country || 'Unknown',
            countryCode: visitWithLocation.location.countryCode || '',
            city: visitWithLocation.location.city || '',
            region: visitWithLocation.location.region || ''
        };
    } else {
        // Fall back to API
        location = await getGeoLocation(ip);
    }

    // Group events into sessions (events within 30 min of each other)
    const sessions = [];
    let currentSession = null;
    const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

    items.forEach(item => {
        const itemTime = new Date(item.timestamp).getTime();

        if (!currentSession || (itemTime - currentSession.lastEventTime) > SESSION_GAP_MS) {
            // Start new session
            currentSession = {
                startTime: item.timestamp,
                endTime: item.timestamp,
                lastEventTime: itemTime,
                events: []
            };
            sessions.push(currentSession);
        }

        currentSession.events.push({
            type: item.type,
            timestamp: item.timestamp,
            // Include type-specific data
            ...(item.type === 'command' && { command: item.command }),
            ...(item.type === 'chat' && {
                userMessage: item.userMessage,
                botResponse: item.botResponse,
                sessionId: item.sessionId
            }),
            ...(item.type === 'visit' && { userAgent: item.userAgent })
        });

        currentSession.endTime = item.timestamp;
        currentSession.lastEventTime = itemTime;
    });

    // Remove helper field and add summary
    sessions.forEach(session => {
        delete session.lastEventTime;
        session.totalEvents = session.events.length;
        session.visits = session.events.filter(e => e.type === 'visit').length;
        session.commands = session.events.filter(e => e.type === 'command').length;
        session.chats = session.events.filter(e => e.type === 'chat').length;
    });

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            ip,
            location,
            totalEvents: items.length,
            totalSessions: sessions.length,
            sessions: sessions.reverse() // Most recent first
        })
    };
}

async function getVisitors() {
    // Scan all items
    const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME
    }));

    const items = result.Items || [];

    // Get unique IPs with their activity
    const ipMap = {};
    items.forEach(item => {
        const ip = item.ip;
        if (!ip || ip === 'unknown' || ip === '') return;

        if (!ipMap[ip]) {
            ipMap[ip] = {
                ip,
                firstSeen: item.timestamp,
                lastSeen: item.timestamp,
                totalEvents: 0,
                visits: 0,
                commands: 0,
                chats: 0
            };
        }

        ipMap[ip].totalEvents++;
        if (item.type === 'visit') ipMap[ip].visits++;
        if (item.type === 'command') ipMap[ip].commands++;
        if (item.type === 'chat') ipMap[ip].chats++;

        // Update first/last seen
        if (new Date(item.timestamp) < new Date(ipMap[ip].firstSeen)) {
            ipMap[ip].firstSeen = item.timestamp;
        }
        if (new Date(item.timestamp) > new Date(ipMap[ip].lastSeen)) {
            ipMap[ip].lastSeen = item.timestamp;
        }
    });

    const visitors = Object.values(ipMap);

    // First, try to get stored locations from visit logs
    const storedLocations = {};
    items.forEach(item => {
        if (item.location && item.ip && !storedLocations[item.ip]) {
            storedLocations[item.ip] = {
                country: item.location.country || 'Unknown',
                countryCode: item.location.countryCode || '',
                city: item.location.city || '',
                region: item.location.region || ''
            };
        }
    });

    // For IPs without stored location, fetch from API (throttled)
    const ipsWithoutLocation = visitors
        .filter(v => !storedLocations[v.ip])
        .map(v => v.ip);

    const geoResults = ipsWithoutLocation.length > 0
        ? await getGeoLocationsThrottled(ipsWithoutLocation)
        : {};

    const visitorsWithGeo = visitors.map(visitor => ({
        ...visitor,
        location: storedLocations[visitor.ip] || geoResults[visitor.ip] || null
    }));

    // Sort by last seen (most recent first)
    visitorsWithGeo.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            totalVisitors: visitorsWithGeo.length,
            visitors: visitorsWithGeo
        })
    };
}
