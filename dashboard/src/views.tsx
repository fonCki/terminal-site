import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BookOpen, ChevronDown, ChevronRight, MessageSquare, Search, Users } from 'lucide-react';
import type { Geo, GuestbookEntry, Site } from './api';
import {
  KIND_LABEL, fmtDate, fmtDateTime, formatDuration, localDay, relative,
  type ChatThread, type FeedEvent, type Kind, type Session, type Stats, type Visitor,
} from './model';
import { BotTag, Empty, EventRow, IpLink, Kpi, Location, RankList, SiteBadge, Time, VisitorTags } from './components';

export interface Common {
  geo: Record<string, Geo>;
  visitorsByIp: Map<string, Visitor>;
  myIps: Set<string>;
  onSelectIp: (ip: string) => void;
}

const C = { terminal: '#98971a', win95: '#458588', grid: '#3c3836', axis: '#a89984' };
const tooltipStyle = { contentStyle: { backgroundColor: '#1d2021', border: '1px solid #3c3836', fontSize: 12 }, labelStyle: { color: '#ebdbb2' } };

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

const ALL_KINDS: Kind[] = ['visit', 'command', 'chat', 'window', 'click', 'cv', 'guestbook', 'session'];

export function ActivityView({ feed, common }: { feed: FeedEvent[]; common: Common }) {
  const [site, setSite] = useState<'all' | Site>('all');
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(['visit', 'command', 'chat', 'window', 'cv', 'guestbook']));
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(150);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feed.filter(e => {
      if (site !== 'all' && e.site !== site) return false;
      if (!kinds.has(e.kind)) return false;
      if (q) {
        const v = common.visitorsByIp.get(e.ip);
        const hay = [e.ip, v?.geo?.country, v?.geo?.city, e.raw?.command, e.raw?.userMessage, e.raw?.botResponse, e.raw?.appName, e.raw?.target, e.guestbook?.name, e.guestbook?.message]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [feed, site, kinds, query, common.visitorsByIp]);

  const toggleKind = (k: Kind) => setKinds(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const shown = filtered.slice(0, limit);
  let lastDay = '';

  return (
    <section className="activity">
      <div className="toolbar">
        <div className="seg">
          {(['all', 'terminal', 'win95'] as const).map(s => (
            <button key={s} className={site === s ? 'on' : ''} onClick={() => setSite(s)}>{s === 'all' ? 'Both sites' : s === 'terminal' ? 'Terminal' : 'Win95'}</button>
          ))}
        </div>
        <div className="chips">
          {ALL_KINDS.map(k => (
            <button key={k} className={`chip tone-${k} ${kinds.has(k) ? 'on' : ''}`} onClick={() => toggleKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <label className="search"><Search size={14} /><input placeholder="Search IP, country, command, message…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <span className="dim small">{filtered.length} events</span>
      </div>

      {shown.length === 0 ? <Empty icon={<Activity size={40} />}>Nothing matches these filters</Empty> : (
        <div className="feed">
          {shown.map(e => {
            const day = localDay(e.time);
            const header = day !== lastDay ? <div key={`d-${day}`} className="day-sep">{fmtDate(e.time)} <span className="dim">· {relative(e.time)}</span></div> : null;
            lastDay = day;
            const v = common.visitorsByIp.get(e.ip);
            return (
              <div key={e.id}>
                {header}
                <EventRow e={e} showIp geo={common.geo[e.ip]} onSelectIp={common.onSelectIp} me={common.myIps.has(e.ip)} bot={v?.botReason} />
              </div>
            );
          })}
          {filtered.length > limit && <button className="more" onClick={() => setLimit(l => l + 200)}>Show more ({filtered.length - limit} left)</button>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Visitors
// ---------------------------------------------------------------------------

function summarise(v: Visitor): string {
  const parts: string[] = [];
  const t = v.countsBySite.terminal;
  const w = v.countsBySite.win95;
  if (t.visit) parts.push(`${t.visit} term visit${t.visit > 1 ? 's' : ''}`);
  if (t.command) parts.push(`${t.command} cmd${t.command > 1 ? 's' : ''}`);
  if (w.visit) parts.push(`${w.visit} win95 visit${w.visit > 1 ? 's' : ''}`);
  if (w.window) parts.push(`${w.window} windows`);
  if (v.counts.cv) parts.push(`CV ×${v.counts.cv}`);
  if (v.counts.chat) parts.push(`${v.counts.chat} chat msg${v.counts.chat > 1 ? 's' : ''}`);
  if (v.counts.guestbook) parts.push('guestbook');
  return parts.join(' · ');
}

export function VisitorsView({ visitors, selectedIp, common, toggleMe }: {
  visitors: Visitor[];
  selectedIp: string | null;
  common: Common;
  toggleMe: (ip: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [hideBots, setHideBots] = useState(false);
  const [onlyChat, setOnlyChat] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visitors.filter(v => {
      if (hideBots && v.isBot) return false;
      if (onlyChat && v.counts.chat === 0 && v.counts.guestbook === 0) return false;
      if (q && !`${v.ip} ${v.geo?.country ?? ''} ${v.geo?.city ?? ''} ${v.geo?.org ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visitors, query, hideBots, onlyChat]);

  const selected = selectedIp ? common.visitorsByIp.get(selectedIp) ?? null : null;

  return (
    <section className="split">
      <div className="pane list-pane">
        <div className="pane-head">
          <h3><Users size={14} /> Visitors <span className="dim">({list.length})</span></h3>
          <label className="search"><Search size={14} /><input placeholder="IP, country, city, network…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={hideBots} onChange={e => setHideBots(e.target.checked)} /> hide bots / datacenter / VPN</label>
          <label className="check"><input type="checkbox" checked={onlyChat} onChange={e => setOnlyChat(e.target.checked)} /> only chatted / signed</label>
        </div>
        <div className="pane-body">
          {list.map(v => (
            <div key={v.ip} className={`row ${selectedIp === v.ip ? 'active' : ''}`} onClick={() => common.onSelectIp(v.ip)}>
              <div className="row-top">
                <span className="mono ip">{v.ip === 'unknown' ? 'unknown IP' : v.ip}</span>
                <span className="sites">{v.sites.map(s => <SiteBadge key={s} site={s} />)}</span>
                <Time time={v.lastSeen} />
              </div>
              <div className="row-mid"><Location geo={v.geo} ip={v.ip} /><VisitorTags v={v} isMe={common.myIps.has(v.ip)} /></div>
              <div className="row-sub dim">{summarise(v)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="pane detail-pane">
        {selected ? <VisitorDetail v={selected} common={common} toggleMe={toggleMe} /> : <Empty icon={<Users size={40} />}>Select a visitor to see everything they did, on both sites</Empty>}
      </div>
    </section>
  );
}

function VisitorDetail({ v, common, toggleMe }: { v: Visitor; common: Common; toggleMe: (ip: string) => void }) {
  const isMe = common.myIps.has(v.ip);
  const [open, setOpen] = useState<Set<string>>(() => new Set(v.sessions.slice(0, 3).map(s => s.id)));
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandAll = () => setOpen(new Set(v.sessions.map(s => s.id)));

  return (
    <>
      <div className="pane-head detail-head">
        <div>
          <h3 className="mono">{v.ip === 'unknown' ? 'Events without IP' : v.ip} <VisitorTags v={v} isMe={isMe} /></h3>
          <div className="detail-geo">
            <Location geo={v.geo} ip={v.ip} />
            {v.geo?.region && <span className="dim"> · {v.geo.region}</span>}
            {(v.geo?.org || v.geo?.isp) && <span className="dim"> · {v.geo.org || v.geo.isp}</span>}
          </div>
          <div className="dim small">
            First seen {fmtDateTime(v.firstSeen)} · last seen {fmtDateTime(v.lastSeen)} ({relative(v.lastSeen)}) · active on {v.days.length} day{v.days.length > 1 ? 's' : ''}
          </div>
        </div>
        {v.ip !== 'unknown' && (
          <button className={`btn ${isMe ? 'on' : ''}`} onClick={() => toggleMe(v.ip)} title="Marked IPs are excluded from the stats when 'hide my traffic' is on">
            {isMe ? 'This is me ✓' : 'Mark as me'}
          </button>
        )}
      </div>
      <div className="kpis compact">
        <Kpi label="Sessions" value={v.sessions.length} />
        <Kpi label="Terminal visits" value={v.countsBySite.terminal.visit} sub={`${v.countsBySite.terminal.command} commands`} />
        <Kpi label="Win95 visits" value={v.countsBySite.win95.visit} sub={`${v.countsBySite.win95.window} window actions`} />
        <Kpi label="Chat messages" value={v.counts.chat} />
        <Kpi label="CV events" value={v.counts.cv} />
        <Kpi label="Guestbook" value={v.counts.guestbook} />
      </div>
      <div className="pane-body">
        <div className="sessions-head"><span className="dim small">{v.sessions.length} browsing session{v.sessions.length > 1 ? 's' : ''} (gap of 30 min starts a new one)</span><button className="link" onClick={expandAll}>expand all</button></div>
        {v.sessions.map(s => <SessionBlock key={s.id} s={s} open={open.has(s.id)} onToggle={() => toggle(s.id)} />)}
      </div>
    </>
  );
}

function SessionBlock({ s, open, onToggle }: { s: Session; open: boolean; onToggle: () => void }) {
  const dur = s.end - s.start;
  const summary = (Object.keys(s.counts) as Kind[]).filter(k => s.counts[k] > 0 && k !== 'session').map(k => `${s.counts[k]} ${KIND_LABEL[k].toLowerCase()}${s.counts[k] > 1 ? 's' : ''}`).join(' · ');
  return (
    <div className={`session ${open ? 'open' : ''}`}>
      <button className="session-head" onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="session-date">{fmtDateTime(s.start)}</span>
        <span className="sites">{s.sites.map(x => <SiteBadge key={x} site={x} />)}</span>
        <span className="dim">{dur > 0 ? formatDuration(dur) : 'single event'} · {summary}</span>
      </button>
      {open && <div className="session-events">{s.events.map(e => <EventRow key={e.id} e={e} />)}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------

export function ChatsView({ threads, selectedIp, common, onSelect }: { threads: ChatThread[]; selectedIp: string | null; common: Common; onSelect: (ip: string) => void }) {
  const [query, setQuery] = useState('');
  const [site, setSite] = useState<'all' | Site>('all');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter(t => {
      if (site !== 'all' && !t.sites.includes(site)) return false;
      if (!q) return true;
      if (`${t.ip} ${t.geo?.country ?? ''} ${t.geo?.city ?? ''}`.toLowerCase().includes(q)) return true;
      return t.segments.some(seg => seg.messages.some(m => m.userMessage.toLowerCase().includes(q) || m.botResponse.toLowerCase().includes(q)));
    });
  }, [threads, query, site]);

  const selected = selectedIp ? threads.find(t => t.ip === selectedIp) ?? null : null;
  const total = threads.reduce((n, t) => n + t.messageCount, 0);

  return (
    <section className="split">
      <div className="pane list-pane">
        <div className="pane-head">
          <h3><MessageSquare size={14} /> Conversations <span className="dim">({list.length} visitors · {total} messages)</span></h3>
          <div className="seg small">
            {(['all', 'terminal', 'win95'] as const).map(s => (
              <button key={s} className={site === s ? 'on' : ''} onClick={() => setSite(s)}>{s === 'all' ? 'Both' : s === 'terminal' ? 'Terminal' : 'Win95 ICQ'}</button>
            ))}
          </div>
          <label className="search"><Search size={14} /><input placeholder="Search messages, IP, country…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        <div className="pane-body">
          {list.map(t => (
            <div key={t.ip} className={`row ${selectedIp === t.ip ? 'active' : ''}`} onClick={() => onSelect(t.ip)}>
              <div className="row-top">
                <span className="mono ip">{t.ip === 'unknown' ? 'unknown IP' : t.ip}</span>
                <span className="sites">{t.sites.map(s => <SiteBadge key={s} site={s} />)}</span>
                <span className="count">{t.messageCount} msg{t.messageCount > 1 ? 's' : ''}</span>
              </div>
              <div className="row-mid"><Location geo={t.geo} ip={t.ip} />{common.myIps.has(t.ip) && <span className="tag me">me</span>}<BotTag reason={t.botReason} /></div>
              <div className="row-sub dim">
                <span className="preview">“{t.lastMessage}”</span>
                <span> · {t.segments.length} conversation{t.segments.length > 1 ? 's' : ''} · <Time time={t.lastTime} /></span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pane detail-pane">
        {selected ? <ThreadDetail t={selected} common={common} /> : <Empty icon={<MessageSquare size={40} />}>Select a visitor to read every conversation they had, terminal and Win95 together</Empty>}
      </div>
    </section>
  );
}

function ThreadDetail({ t, common }: { t: ChatThread; common: Common }) {
  return (
    <>
      <div className="pane-head detail-head">
        <div>
          <h3><IpLink ip={t.ip} onSelect={common.onSelectIp} me={common.myIps.has(t.ip)} bot={t.botReason} /></h3>
          <div className="detail-geo"><Location geo={t.geo} ip={t.ip} />{t.geo?.org && <span className="dim"> · {t.geo.org}</span>}</div>
          <div className="dim small">{t.messageCount} messages in {t.segments.length} conversation{t.segments.length > 1 ? 's' : ''} · first {fmtDateTime(t.firstTime)} · last {fmtDateTime(t.lastTime)}</div>
        </div>
        <button className="link" onClick={() => common.onSelectIp(t.ip)}>full activity →</button>
      </div>
      <div className="pane-body thread">
        {t.segments.map((seg, i) => (
          <div key={`${seg.sessionId}-${i}`} className="segment">
            <div className="day-sep">
              <SiteBadge site={seg.site} /> {fmtDateTime(seg.start)}
              <span className="dim"> · {seg.messages.length} message{seg.messages.length > 1 ? 's' : ''}{seg.end > seg.start ? ` · ${formatDuration(seg.end - seg.start)}` : ''}</span>
            </div>
            {seg.messages.map(m => (
              <div key={m.id} className="exchange">
                <div className="bubble user"><span className="who">Visitor</span><Time time={m.time} mode="time" />{m.userMessage}</div>
                <div className="bubble bot"><span className="who">Alfonso (AI)</span>{m.botResponse}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Guestbook
// ---------------------------------------------------------------------------

export function GuestbookView({ entries, visitorCount, error, common }: { entries: GuestbookEntry[]; visitorCount: number; error?: string; common: Common }) {
  const real = entries.filter(e => !e.seed);
  const seed = entries.filter(e => e.seed);
  return (
    <section className="guestbook">
      <div className="kpis compact">
        <Kpi label="Real signatures" value={real.length} />
        <Kpi label="Seed entries (1997 jokes)" value={seed.length} />
        <Kpi label="Win95 hit counter" value={visitorCount} sub="incremented on each Win95 load" />
      </div>
      {error && <p className="warn">Guestbook could not be read: {error}</p>}
      {real.length === 0 ? <Empty icon={<BookOpen size={40} />}>No real signatures yet</Empty> : (
        <div className="entries">
          {[...real, ...seed].map(e => {
            const v = common.visitorsByIp.get(e.ip);
            const time = new Date(e.ts).getTime();
            return (
              <div key={e.id} className={`entry ${e.seed ? 'seed' : ''}`}>
                <div className="entry-head">
                  <strong>{e.name}</strong>
                  {e.seed ? <span className="tag">seed</span> : <IpLink ip={e.ip} onSelect={common.onSelectIp} me={common.myIps.has(e.ip)} bot={v?.botReason} />}
                  {!e.seed && <Location geo={common.geo[e.ip]} ip={e.ip} />}
                  <span className="dim"><Time time={time} mode="datetime" /> · {relative(time)}</span>
                </div>
                <p>{e.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function StatsView({ stats, feedCount, generatedAt }: { stats: Stats; feedCount: number; generatedAt: string }) {
  const [range, setRange] = useState<30 | 90 | 0>(90);
  const daily = useMemo(() => {
    if (!range) return stats.daily;
    const cutoff = localDay(Date.now() - range * 86400000);
    return stats.daily.filter(d => d.date >= cutoff);
  }, [stats.daily, range]);

  const s = stats;
  const row = (label: string, t: React.ReactNode, w: React.ReactNode) => (
    <tr key={label}><th>{label}</th><td>{t}</td><td>{w}</td></tr>
  );

  return (
    <section className="stats">
      <div className="kpis">
        <Kpi label="Distinct visitors" value={s.distinctVisitors} sub={`${s.distinctHumans} look human · ${s.distinctVisitors - s.distinctHumans} bots?`} />
        <Kpi label="Returning visitors" value={s.returning} sub="active on more than one day" />
        <Kpi label="Chat messages" value={s.terminal.chatMessages + s.win95.chatMessages} sub={`${s.terminal.chatVisitors + s.win95.chatVisitors} visitors chatted`} />
        <Kpi label="CV opened" value={s.win95.cvOpened} sub={`${s.win95.cvDownloaded} downloaded`} />
        <Kpi label="Guestbook" value={s.win95.guestbook} sub="real signatures" />
        <Kpi label="Events stored" value={feedCount} sub={`fetched ${new Date(generatedAt).toLocaleTimeString()}`} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Per site</h3>
          <table className="compare">
            <thead><tr><th></th><th><SiteBadge site="terminal" /> alfonso.ridao.ar</th><th><SiteBadge site="win95" /> win.ridao.ar</th></tr></thead>
            <tbody>
              {row('Visitors (IPs)', s.terminal.visitors, s.win95.visitors)}
              {row('…of which look human', s.terminal.humans, s.win95.humans)}
              {row('Page loads', s.terminal.visits, s.win95.visits)}
              {row('Browsing sessions', s.terminal.sessions, s.win95.sessions)}
              {row('Typical Win95 stay (median)', '—', s.win95.medianSessionMs ? formatDuration(s.win95.medianSessionMs) : '—')}
              {row('Commands typed', s.terminal.commands, '—')}
              {row('Chat messages', s.terminal.chatMessages, s.win95.chatMessages)}
              {row('Visitors who chatted', s.terminal.chatVisitors, s.win95.chatVisitors)}
              {row('CV opened', '—', s.win95.cvOpened)}
              {row('Guestbook signatures', '—', s.win95.guestbook)}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Countries <span className="dim">(by visitor)</span></h3>
          <RankList items={s.countries} color="#d79921" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Daily activity <span className="dim">(events per day, local time)</span></h3>
          <div className="seg small">
            {([30, 90, 0] as const).map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r === 0 ? 'All' : `${r} days`}</button>)}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
            <YAxis stroke={C.axis} tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="terminal" stackId="a" fill={C.terminal} name="Terminal" />
            <Bar dataKey="win95" stackId="a" fill={C.win95} name="Win95" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>By hour <span className="dim">(your local time)</span></h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="hour" stroke={C.axis} tick={{ fontSize: 11 }} tickFormatter={h => `${h}h`} />
              <YAxis stroke={C.axis} tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} labelFormatter={h => `${h}:00`} />
              <Bar dataKey="terminal" stackId="a" fill={C.terminal} name="Terminal" />
              <Bar dataKey="win95" stackId="a" fill={C.win95} name="Win95" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>By weekday</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.weekday}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="day" stroke={C.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={C.axis} tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="terminal" stackId="a" fill={C.terminal} name="Terminal" />
              <Bar dataKey="win95" stackId="a" fill={C.win95} name="Win95" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid3">
        <div className="card"><h3><SiteBadge site="terminal" /> Top commands</h3><RankList items={s.topCommands} total={s.terminal.commands} color={C.terminal} /></div>
        <div className="card"><h3><SiteBadge site="win95" /> Windows opened</h3><RankList items={s.topWindows} color={C.win95} /></div>
        <div className="card"><h3><SiteBadge site="win95" /> Clicks</h3><RankList items={s.topClicks} color="#b16286" /></div>
        <div className="card"><h3><SiteBadge site="win95" /> Referrers</h3><RankList items={s.referrers} total={s.win95.visits} color="#d65d0e" /></div>
        <div className="card"><h3><SiteBadge site="win95" /> Devices</h3><RankList items={s.devices} total={s.win95.visits} color="#689d6a" /></div>
        <div className="card">
          <h3>Notes on the data</h3>
          <ul className="notes">
            <li>The terminal logs only the IP and a stored location per page load; it does not record browser or referrer.</li>
            <li>Red tags: “bot” = crawler user agent, “datacenter” = cloud/CDN network (Facebook, Google crawlers, scanners), “vpn/proxy” = a real person behind a VPN, most likely.</li>
            <li>Terminal chat messages used to be counted twice (also as a command); that is fixed here.</li>
            <li>The Win95 site sends its session-end event several times; only one per session is kept.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

