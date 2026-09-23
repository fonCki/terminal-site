import type { DashboardResponse, Geo, GuestbookEntry, RawEvent, Site } from './api';

// ---------------------------------------------------------------------------
// Unified feed: every event from both sites plus guestbook entries
// ---------------------------------------------------------------------------

export type Kind = 'visit' | 'command' | 'chat' | 'click' | 'window' | 'cv' | 'session' | 'guestbook';

export interface FeedEvent {
  id: string;
  time: number;          // epoch ms
  ts: string;
  ip: string;
  site: Site;
  kind: Kind;
  sessionId?: string;
  raw?: RawEvent;
  guestbook?: GuestbookEntry;
}

export const KIND_LABEL: Record<Kind, string> = {
  visit: 'Visit',
  command: 'Command',
  chat: 'Chat',
  click: 'Click',
  window: 'Window',
  cv: 'CV',
  session: 'Session end',
  guestbook: 'Guestbook',
};

const KIND_BY_TYPE: Record<RawEvent['type'], Kind> = {
  'visit': 'visit',
  'command': 'command',
  'chat': 'chat',
  'win-visit': 'visit',
  'win-click': 'click',
  'win-window': 'window',
  'win-chat': 'chat',
  'win-cv': 'cv',
  'win-session': 'session',
};

export function buildFeed(data: DashboardResponse): FeedEvent[] {
  const feed: FeedEvent[] = data.events.map(e => ({
    id: e.id,
    time: new Date(e.ts).getTime(),
    ts: e.ts,
    ip: e.ip,
    site: e.site,
    kind: KIND_BY_TYPE[e.type] ?? 'visit',
    sessionId: e.sessionId,
    raw: e,
  }));
  data.guestbook.entries.forEach(g => {
    if (g.seed) return; // hand-written 1997 seed entries are not visitor activity
    feed.push({
      id: `guestbook#${g.id}`,
      time: new Date(g.ts).getTime(),
      ts: g.ts,
      ip: g.ip,
      site: 'win95',
      kind: 'guestbook',
      guestbook: g,
    });
  });
  feed.sort((a, b) => b.time - a.time);
  return feed;
}

// ---------------------------------------------------------------------------
// Describing an event in one line
// ---------------------------------------------------------------------------

export interface Description {
  title: string;      // short, e.g. "Opened window"
  detail: string;     // e.g. "icq"
  tone: 'visit' | 'command' | 'chat' | 'click' | 'window' | 'cv' | 'session' | 'guestbook';
}

export function describe(e: FeedEvent): Description {
  const r = e.raw;
  switch (e.kind) {
    case 'visit': {
      const parts: string[] = [];
      if (r?.referrer && r.referrer !== 'direct') parts.push(`from ${shortUrl(r.referrer)}`);
      const dev = deviceOf(r?.userAgent);
      if (dev) parts.push(dev);
      if (r?.screenWidth && r?.screenHeight) parts.push(`${r.screenWidth}×${r.screenHeight}`);
      return { title: e.site === 'win95' ? 'Opened Win95 site' : 'Opened terminal', detail: parts.join(' · '), tone: 'visit' };
    }
    case 'command':
      return { title: 'Ran command', detail: r?.command?.trim() ? r.command : '(empty enter)', tone: 'command' };
    case 'chat':
      return { title: e.site === 'win95' ? 'ICQ chat' : 'Terminal chat', detail: r?.userMessage ?? '', tone: 'chat' };
    case 'click':
      return { title: 'Clicked', detail: [r?.element, r?.target].filter(Boolean).join(' → '), tone: 'click' };
    case 'window':
      return { title: r?.action === 'close' ? 'Closed window' : r?.action === 'open' ? 'Opened window' : `Window ${r?.action ?? ''}`, detail: r?.appName ?? '', tone: 'window' };
    case 'cv': {
      const action = r?.action ?? '';
      const map: Record<string, string> = { opened: 'Opened CV', loaded: 'CV loaded', 'page-change': 'Turned CV page', downloaded: 'Downloaded CV' };
      return { title: map[action] ?? `CV ${action}`, detail: r?.pageNumber ? `page ${r.pageNumber}` : '', tone: 'cv' };
    }
    case 'session':
      return { title: 'Left Win95 site', detail: r?.durationMs ? `after ${formatDuration(r.durationMs)}` : '', tone: 'session' };
    case 'guestbook':
      return { title: `Signed guestbook as “${e.guestbook?.name ?? ''}”`, detail: e.guestbook?.message ?? '', tone: 'guestbook' };
  }
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function deviceOf(ua?: string): string {
  if (!ua) return '';
  const os =
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /CrOS/.test(ua) ? 'ChromeOS' :
    /Linux/.test(ua) ? 'Linux' : '';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : '';
  const bot = /bot|crawler|spider|facebookexternalhit|preview|fetch/i.test(ua) ? 'bot' : '';
  return [os, browser, bot].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Visitors (grouped by IP) and their browsing sessions
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  ip: string;
  start: number;
  end: number;
  sites: Site[];
  events: FeedEvent[];   // chronological
  counts: Record<Kind, number>;
}

export interface Visitor {
  ip: string;
  geo: Geo | null;
  firstSeen: number;
  lastSeen: number;
  days: string[];                 // distinct local dates with activity
  sites: Site[];
  counts: Record<Kind, number>;
  countsBySite: Record<Site, Record<Kind, number>>;
  sessions: Session[];            // most recent first
  events: FeedEvent[];            // most recent first
  isBot: boolean;                 // hosting / proxy network or bot user agent
  botReason: string | null;       // 'bot', 'vpn/proxy' or 'datacenter'
}

export const SESSION_GAP_MS = 30 * 60 * 1000;

function emptyCounts(): Record<Kind, number> {
  return { visit: 0, command: 0, chat: 0, click: 0, window: 0, cv: 0, session: 0, guestbook: 0 };
}

export function localDay(time: number): string {
  const d = new Date(time);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function splitSessions(ip: string, eventsDesc: FeedEvent[]): Session[] {
  const asc = [...eventsDesc].sort((a, b) => a.time - b.time);
  const sessions: Session[] = [];
  let current: Session | null = null;
  asc.forEach(e => {
    if (!current || e.time - current.end > SESSION_GAP_MS) {
      current = { id: `${ip}#${e.time}`, ip, start: e.time, end: e.time, sites: [], events: [], counts: emptyCounts() };
      sessions.push(current);
    }
    current.events.push(e);
    current.end = e.time;
    current.counts[e.kind]++;
    if (!current.sites.includes(e.site)) current.sites.push(e.site);
  });
  return sessions.reverse();
}

export function buildVisitors(feed: FeedEvent[], geo: Record<string, Geo>): Visitor[] {
  const byIp = new Map<string, FeedEvent[]>();
  feed.forEach(e => {
    const list = byIp.get(e.ip);
    if (list) list.push(e); else byIp.set(e.ip, [e]);
  });

  const visitors: Visitor[] = [];
  byIp.forEach((events, ip) => {
    const counts = emptyCounts();
    const countsBySite: Record<Site, Record<Kind, number>> = { terminal: emptyCounts(), win95: emptyCounts() };
    const days = new Set<string>();
    const sites: Site[] = [];
    let botUa = false;
    events.forEach(e => {
      counts[e.kind]++;
      countsBySite[e.site][e.kind]++;
      days.add(localDay(e.time));
      if (!sites.includes(e.site)) sites.push(e.site);
      if (e.raw?.userAgent && /bot|crawler|spider|facebookexternalhit/i.test(e.raw.userAgent)) botUa = true;
    });
    const g = geo[ip] ?? null;
    const botReason = botUa ? 'bot' : g?.proxy ? 'vpn/proxy' : g?.hosting ? 'datacenter' : null;
    visitors.push({
      ip,
      geo: g,
      firstSeen: events[events.length - 1].time,
      lastSeen: events[0].time,
      days: [...days].sort(),
      sites,
      counts,
      countsBySite,
      sessions: splitSessions(ip, events),
      events,
      isBot: botReason !== null,
      botReason,
    });
  });

  visitors.sort((a, b) => b.lastSeen - a.lastSeen);
  return visitors;
}

// ---------------------------------------------------------------------------
// Chat threads: every conversation of one IP, both sites, in order
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  time: number;
  site: Site;
  sessionId: string;
  userMessage: string;
  botResponse: string;
}

export interface ChatSegment {
  sessionId: string;
  site: Site;
  start: number;
  end: number;
  messages: ChatMessage[];
}

export interface ChatThread {
  ip: string;
  geo: Geo | null;
  isBot: boolean;
  botReason: string | null;
  messageCount: number;
  sites: Site[];
  lastTime: number;
  firstTime: number;
  segments: ChatSegment[];   // chronological
  lastMessage: string;
}

export function buildChatThreads(visitors: Visitor[]): ChatThread[] {
  const threads: ChatThread[] = [];
  visitors.forEach(v => {
    const msgs: ChatMessage[] = v.events
      .filter(e => e.kind === 'chat' && e.raw)
      .map(e => ({
        id: e.id,
        time: e.time,
        site: e.site,
        sessionId: e.raw!.sessionId ?? 'unknown',
        userMessage: e.raw!.userMessage ?? '',
        botResponse: e.raw!.botResponse ?? '',
      }))
      .sort((a, b) => a.time - b.time);
    if (msgs.length === 0) return;

    // A segment is one chat session; consecutive sessions closer than the
    // browsing-session gap still get their own separator (new "chat" command).
    const segments: ChatSegment[] = [];
    let current: ChatSegment | null = null;
    msgs.forEach(m => {
      if (!current || current.sessionId !== m.sessionId || current.site !== m.site) {
        current = { sessionId: m.sessionId, site: m.site, start: m.time, end: m.time, messages: [] };
        segments.push(current);
      }
      current.messages.push(m);
      current.end = m.time;
    });

    const sites: Site[] = [];
    msgs.forEach(m => { if (!sites.includes(m.site)) sites.push(m.site); });

    threads.push({
      ip: v.ip,
      geo: v.geo,
      isBot: v.isBot,
      botReason: v.botReason,
      messageCount: msgs.length,
      sites,
      lastTime: msgs[msgs.length - 1].time,
      firstTime: msgs[0].time,
      segments,
      lastMessage: msgs[msgs.length - 1].userMessage,
    });
  });
  threads.sort((a, b) => b.lastTime - a.lastTime);
  return threads;
}

// ---------------------------------------------------------------------------
// Aggregate statistics
// ---------------------------------------------------------------------------

export interface Counted { name: string; count: number }

export interface SiteStats {
  visitors: number;        // distinct IPs (excluding unknown)
  humans: number;          // visitors not flagged as bots
  visits: number;
  sessions: number;
  commands: number;
  chatMessages: number;
  chatVisitors: number;
  cvOpened: number;
  cvDownloaded: number;
  guestbook: number;
  medianSessionMs: number; // from win-session events (win95 only); median, since open tabs skew the mean
}

export interface Stats {
  terminal: SiteStats;
  win95: SiteStats;
  daily: { date: string; terminal: number; win95: number }[];
  hourly: { hour: number; terminal: number; win95: number }[];
  weekday: { day: string; terminal: number; win95: number }[];
  topCommands: Counted[];
  topWindows: Counted[];
  topClicks: Counted[];
  referrers: Counted[];
  devices: Counted[];
  countries: Counted[];
  returning: number;       // visitors active on more than one day
  distinctVisitors: number;
  distinctHumans: number;
}

function top(map: Map<string, number>, n = 10): Counted[] {
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, n);
}

function inc(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function buildStats(feed: FeedEvent[], visitors: Visitor[]): Stats {
  const siteStats = (site: Site): SiteStats => {
    const ev = feed.filter(e => e.site === site);
    const vs = visitors.filter(v => v.sites.includes(site) && v.ip !== 'unknown');
    const sessions = visitors.reduce((n, v) => n + v.sessions.filter(s => s.sites.includes(site)).length, 0);
    const durations = ev.filter(e => e.kind === 'session' && e.raw?.durationMs).map(e => e.raw!.durationMs!);
    return {
      visitors: vs.length,
      humans: vs.filter(v => !v.isBot).length,
      visits: ev.filter(e => e.kind === 'visit').length,
      sessions,
      commands: ev.filter(e => e.kind === 'command').length,
      chatMessages: ev.filter(e => e.kind === 'chat').length,
      chatVisitors: new Set(ev.filter(e => e.kind === 'chat').map(e => e.ip)).size,
      cvOpened: ev.filter(e => e.kind === 'cv' && e.raw?.action === 'opened').length,
      cvDownloaded: ev.filter(e => e.kind === 'cv' && e.raw?.action === 'downloaded').length,
      guestbook: ev.filter(e => e.kind === 'guestbook').length,
      medianSessionMs: durations.length ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)] : 0,
    };
  };

  const daily = new Map<string, { terminal: number; win95: number }>();
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, terminal: 0, win95: 0 }));
  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekday = weekdayNames.map(day => ({ day, terminal: 0, win95: 0 }));
  const commands = new Map<string, number>();
  const windows = new Map<string, number>();
  const clicks = new Map<string, number>();
  const referrers = new Map<string, number>();
  const devices = new Map<string, number>();
  const countries = new Map<string, number>();

  feed.forEach(e => {
    const day = localDay(e.time);
    const d = daily.get(day) ?? { terminal: 0, win95: 0 };
    d[e.site]++;
    daily.set(day, d);
    const date = new Date(e.time);
    hourly[date.getHours()][e.site]++;
    weekday[(date.getDay() + 6) % 7][e.site]++;

    if (e.kind === 'command') inc(commands, e.raw?.command?.trim() || '(empty)');
    if (e.kind === 'window' && e.raw?.action === 'open') inc(windows, e.raw.appName ?? 'unknown');
    if (e.kind === 'click') inc(clicks, [e.raw?.element, e.raw?.target].filter(Boolean).join(' → '));
    if (e.kind === 'visit' && e.site === 'win95') inc(referrers, e.raw?.referrer && e.raw.referrer !== 'direct' ? shortUrl(e.raw.referrer) : 'direct');
    if (e.kind === 'visit' && e.raw?.userAgent) inc(devices, deviceOf(e.raw.userAgent) || 'unknown');
  });

  visitors.forEach(v => {
    if (v.ip === 'unknown') return;
    inc(countries, v.geo?.country || 'Unknown');
  });

  return {
    terminal: siteStats('terminal'),
    win95: siteStats('win95'),
    daily: [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, c]) => ({ date, ...c })),
    hourly,
    weekday,
    topCommands: top(commands, 12),
    topWindows: top(windows, 10),
    topClicks: top(clicks, 10),
    referrers: top(referrers, 10),
    devices: top(devices, 10),
    countries: top(countries, 15),
    returning: visitors.filter(v => v.ip !== 'unknown' && v.days.length > 1).length,
    distinctVisitors: visitors.filter(v => v.ip !== 'unknown').length,
    distinctHumans: visitors.filter(v => v.ip !== 'unknown' && !v.isBot).length,
  };
}

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

export function flag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const base = 0x1f1e6;
  const cc = countryCode.toUpperCase();
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65);
}

export function place(geo: Geo | null | undefined): string {
  if (!geo) return 'Unknown location';
  return [geo.city, geo.country].filter(Boolean).join(', ');
}

export function relative(time: number, now = Date.now()): string {
  const diff = Math.max(0, now - time);
  const s = Math.round(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.round(d / 365)} y ago`;
}

export function fmtTime(time: number): string {
  return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDate(time: number): string {
  return new Date(time).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(time: number): string {
  return `${fmtDate(time)} ${new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
