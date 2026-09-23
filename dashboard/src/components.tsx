import type { ReactNode } from 'react';
import { Bot, MapPin, MessageSquare, Monitor, Terminal, User } from 'lucide-react';
import type { Geo, Site } from './api';
import { describe, flag, fmtDateTime, fmtTime, place, relative, type FeedEvent, type Visitor } from './model';

export function SiteBadge({ site, withLabel = true }: { site: Site; withLabel?: boolean }) {
  return (
    <span className={`badge site-${site}`} title={site === 'win95' ? 'win.ridao.ar' : 'alfonso.ridao.ar (terminal)'}>
      {site === 'win95' ? <Monitor size={11} /> : <Terminal size={11} />}
      {withLabel && (site === 'win95' ? 'Win95' : 'Term')}
    </span>
  );
}

export function Location({ geo, ip }: { geo: Geo | null | undefined; ip?: string }) {
  if (ip === 'unknown') return <span className="dim">IP not captured</span>;
  const f = flag(geo?.countryCode);
  return (
    <span className="location" title={geo ? `${geo.org || geo.isp}${geo.hosting ? ' · hosting/datacenter' : ''}${geo.proxy ? ' · proxy/VPN' : ''}` : undefined}>
      {f ? <span className="flag">{f}</span> : <MapPin size={12} />}
      {place(geo)}
    </span>
  );
}

export function BotTag({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  const title = reason === 'bot' ? 'User agent identifies as a crawler' : reason === 'vpn/proxy' ? 'IP belongs to a VPN or proxy provider' : 'IP belongs to a datacenter / cloud / CDN network (crawlers, scanners)';
  return <span className="tag bot" title={title}><Bot size={10} /> {reason}</span>;
}

export function IpLink({ ip, onSelect, me, bot }: { ip: string; onSelect?: (ip: string) => void; me?: boolean; bot?: string | null }) {
  const label = ip === 'unknown' ? 'unknown IP' : ip;
  return (
    <span className="ip-wrap">
      {onSelect && ip !== 'unknown'
        ? <button className="ip-link" onClick={(ev) => { ev.stopPropagation(); onSelect(ip); }}>{label}</button>
        : <span className="ip-link static">{label}</span>}
      {me && <span className="tag me" title="Marked as you">me</span>}
      <BotTag reason={bot} />
    </span>
  );
}

export function VisitorTags({ v, isMe }: { v: Visitor; isMe: boolean }) {
  return (
    <span className="tags">
      {isMe && <span className="tag me">me</span>}
      <BotTag reason={v.botReason} />
      {v.days.length > 1 && <span className="tag returning" title={`Active on ${v.days.length} different days`}>returning ×{v.days.length}</span>}
      {v.counts.chat > 0 && <span className="tag chat"><MessageSquare size={10} /> {v.counts.chat}</span>}
      {v.counts.guestbook > 0 && <span className="tag guestbook">guestbook</span>}
    </span>
  );
}

export function Time({ time, mode = 'relative' }: { time: number; mode?: 'relative' | 'time' | 'datetime' }) {
  const full = new Date(time).toLocaleString();
  const text = mode === 'relative' ? relative(time) : mode === 'time' ? fmtTime(time) : fmtDateTime(time);
  return <time className="time" dateTime={new Date(time).toISOString()} title={full}>{text}</time>;
}

// One line of the activity feed / visitor timeline.
export function EventRow({ e, showIp, showDate, geo, onSelectIp, me, bot }: {
  e: FeedEvent;
  showIp?: boolean;
  showDate?: boolean;
  geo?: Geo | null;
  onSelectIp?: (ip: string) => void;
  me?: boolean;
  bot?: string | null;
}) {
  const d = describe(e);
  const isChat = e.kind === 'chat';
  const isGuestbook = e.kind === 'guestbook';
  return (
    <div className={`event tone-${d.tone}`}>
      <div className="event-time">
        <Time time={e.time} mode={showDate ? 'datetime' : 'time'} />
        {showDate && <span className="dim small">{relative(e.time)}</span>}
      </div>
      <SiteBadge site={e.site} withLabel={false} />
      {showIp && (
        <div className="event-who">
          <IpLink ip={e.ip} onSelect={onSelectIp} me={me} bot={bot} />
          <Location geo={geo} ip={e.ip} />
        </div>
      )}
      <div className="event-body">
        <span className="event-title">{d.title}</span>
        {isChat && e.raw ? (
          <div className="event-chat">
            <div className="bubble user"><User size={11} /> {e.raw.userMessage}</div>
            <div className="bubble bot">{e.raw.botResponse}</div>
          </div>
        ) : isGuestbook ? (
          <div className="event-chat"><div className="bubble user">{d.detail}</div></div>
        ) : d.detail ? (
          <span className={`event-detail ${e.kind === 'command' ? 'mono' : ''}`}>{d.detail}</span>
        ) : null}
      </div>
    </div>
  );
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <div className="empty">{icon}<p>{children}</p></div>;
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

export function RankList({ items, total, color }: { items: { name: string; count: number }[]; total?: number; color: string }) {
  if (items.length === 0) return <Empty>No data yet</Empty>;
  const max = items[0].count;
  return (
    <ul className="rank">
      {items.map(it => (
        <li key={it.name}>
          <span className="rank-name mono" title={it.name}>{it.name}</span>
          <span className="rank-bar"><span style={{ width: `${(it.count / max) * 100}%`, background: color }} /></span>
          <span className="rank-count">{it.count}{total ? <span className="dim"> · {((it.count / total) * 100).toFixed(0)}%</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}
