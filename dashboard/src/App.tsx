import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpen, EyeOff, LogOut, MessageSquare, RefreshCw, Terminal, Users } from 'lucide-react';
import { api, clearAuth, getAuthToken, type DashboardResponse } from './api';
import { buildChatThreads, buildFeed, buildStats, buildVisitors, relative } from './model';
import { Login } from './Login';
import { ActivityView, ChatsView, GuestbookView, StatsView, VisitorsView, type Common } from './views';
import './App.css';

type Tab = 'activity' | 'visitors' | 'chats' | 'guestbook' | 'stats';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'activity', label: 'Activity', icon: <Activity size={14} /> },
  { id: 'visitors', label: 'Visitors', icon: <Users size={14} /> },
  { id: 'chats', label: 'Chats', icon: <MessageSquare size={14} /> },
  { id: 'guestbook', label: 'Guestbook', icon: <BookOpen size={14} /> },
  { id: 'stats', label: 'Stats', icon: <BarChart3 size={14} /> },
];

const REFRESH_MS = 60_000;
const MY_IPS_KEY = 'analytics_my_ips';
const HIDE_ME_KEY = 'analytics_hide_me';

function loadMyIps(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(MY_IPS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('analytics_authenticated') === 'true' && !!getAuthToken());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [tab, setTab] = useState<Tab>('activity');
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [myIps, setMyIps] = useState<Set<string>>(loadMyIps);
  const [hideMe, setHideMe] = useState<boolean>(() => localStorage.getItem(HIDE_ME_KEY) === 'true');
  const [, setTick] = useState(0);

  const handleLogout = useCallback(() => {
    clearAuth();
    setIsAuthenticated(false);
    setData(null);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.getDashboard();
      setData(d);
      setFetchedAt(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      if (message === 'Session expired' || message === 'Not authenticated') {
        handleLogout();
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    const interval = setInterval(fetchData, REFRESH_MS);
    const ticker = setInterval(() => setTick(t => t + 1), 30_000); // re-render relative times
    return () => { clearInterval(interval); clearInterval(ticker); };
  }, [isAuthenticated, fetchData]);

  const toggleMe = useCallback((ip: string) => {
    setMyIps(prev => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip); else next.add(ip);
      localStorage.setItem(MY_IPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleHideMe = () => {
    setHideMe(h => { localStorage.setItem(HIDE_ME_KEY, String(!h)); return !h; });
  };

  // Derived model. Everything is computed in the browser from one payload.
  const model = useMemo(() => {
    if (!data) return null;
    const allFeed = buildFeed(data);
    const allVisitors = buildVisitors(allFeed, data.geo);
    const feed = hideMe ? allFeed.filter(e => !myIps.has(e.ip)) : allFeed;
    const visitors = hideMe ? allVisitors.filter(v => !myIps.has(v.ip)) : allVisitors;
    const visitorsByIp = new Map(allVisitors.map(v => [v.ip, v]));
    return {
      feed,
      visitors,
      visitorsByIp,
      threads: buildChatThreads(visitors),
      stats: buildStats(feed, visitors),
    };
  }, [data, hideMe, myIps]);

  const selectIp = useCallback((ip: string) => {
    setSelectedIp(ip);
    setTab('visitors');
  }, []);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const common: Common | null = model && data ? { geo: data.geo, visitorsByIp: model.visitorsByIp, myIps, onSelectIp: selectIp } : null;
  const lastEvent = model?.feed[0];

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <Terminal size={20} />
          <h1>ridao.ar analytics</h1>
          <span className="dim small header-status">
            {data && lastEvent && <>last event {relative(lastEvent.time)} · </>}
            {fetchedAt ? `refreshed ${relative(fetchedAt)}` : ''}
          </span>
        </div>
        <div className="header-right">
          <label className={`check ${hideMe ? 'on' : ''}`} title="Hide traffic from the IPs you marked as yourself">
            <EyeOff size={14} /> <input type="checkbox" checked={hideMe} onChange={toggleHideMe} /> hide my traffic{myIps.size ? ` (${myIps.size} IP${myIps.size > 1 ? 's' : ''})` : ''}
          </label>
          <button onClick={fetchData} className="btn" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
          </button>
          <button onClick={handleLogout} className="btn"><LogOut size={14} /> Logout</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {model && t.id === 'chats' && <span className="pill">{model.threads.length}</span>}
            {model && t.id === 'visitors' && <span className="pill">{model.visitors.length}</span>}
            {data && t.id === 'guestbook' && <span className="pill">{data.guestbook.entries.filter(e => !e.seed).length}</span>}
          </button>
        ))}
      </nav>

      <main>
        {error && (
          <div className="error-box">
            <p>Could not load data: {error}</p>
            <button className="btn" onClick={fetchData}>Retry</button>
          </div>
        )}
        {!data && !error && <div className="loader">Loading everything from both sites…</div>}
        {model && data && common && (
          <>
            {tab === 'activity' && <ActivityView feed={model.feed} common={common} />}
            {tab === 'visitors' && <VisitorsView visitors={model.visitors} selectedIp={selectedIp} common={common} toggleMe={toggleMe} />}
            {tab === 'chats' && <ChatsView threads={model.threads} selectedIp={selectedIp} common={common} onSelect={setSelectedIp} />}
            {tab === 'guestbook' && <GuestbookView entries={data.guestbook.entries} visitorCount={data.guestbook.visitorCount} error={data.guestbook.error} common={common} />}
            {tab === 'stats' && <StatsView stats={model.stats} feedCount={model.feed.length} generatedAt={data.generatedAt} />}
          </>
        )}
      </main>

      <footer>
        <span className="dim small">alfonso.ridao.ar + win.ridao.ar · auto-refreshes every minute · times shown in your local timezone</span>
      </footer>
    </div>
  );
}

export default App;
