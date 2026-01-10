import { useState, useEffect } from 'react';
import { api, getAuthToken, clearAuth } from './api';
import type { Stats, ChatsResponse, VisitorsResponse, VisitorActivityResponse } from './api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, MessageSquare, Terminal, Activity, Clock, Globe, RefreshCw, MapPin, LogOut } from 'lucide-react';
import { Login } from './Login';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if we have a valid token
    return sessionStorage.getItem('analytics_authenticated') === 'true' && !!getAuthToken();
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [chats, setChats] = useState<ChatsResponse | null>(null);
  const [visitors, setVisitors] = useState<VisitorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'chats' | 'commands'>('overview');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<string | null>(null);
  const [visitorActivity, setVisitorActivity] = useState<VisitorActivityResponse | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const handleLogout = () => {
    clearAuth();
    setIsAuthenticated(false);
    setStats(null);
    setChats(null);
    setVisitors(null);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, chatsData, visitorsData] = await Promise.all([
        api.getStats(),
        api.getChats(500),
        api.getVisitors(),
      ]);
      setStats(statsData);
      setChats(chatsData);
      setVisitors(visitorsData);
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
  };

  const handleSelectVisitor = async (ip: string) => {
    if (selectedVisitor === ip) {
      // Deselect if clicking the same visitor
      setSelectedVisitor(null);
      setVisitorActivity(null);
      return;
    }

    setSelectedVisitor(ip);
    setLoadingActivity(true);
    try {
      const activity = await api.getVisitorActivity(ip);
      setVisitorActivity(activity);
    } catch (err) {
      console.error('Failed to load visitor activity:', err);
      setVisitorActivity(null);
    } finally {
      setLoadingActivity(false);
    }
  };

  // useEffect MUST be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const COLORS = ['#98971a', '#458588', '#b16286', '#d79921', '#cc241d', '#689d6a', '#d65d0e', '#83a598'];

  if (loading && !stats) {
    return (
      <div className="app loading">
        <div className="loader">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <div className="error-message">
          <h2>Error loading data</h2>
          <p>{error}</p>
          <button onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <Terminal size={24} />
          <h1>alfonso.ridao.ar Analytics</h1>
        </div>
        <div className="header-right">
          <button onClick={fetchData} className="refresh-btn" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={activeTab === 'visitors' ? 'active' : ''} onClick={() => setActiveTab('visitors')}>
          Visitors
        </button>
        <button className={activeTab === 'chats' ? 'active' : ''} onClick={() => setActiveTab('chats')}>
          Chat Sessions
        </button>
        <button className={activeTab === 'commands' ? 'active' : ''} onClick={() => setActiveTab('commands')}>
          Commands
        </button>
      </nav>

      <main>
        {activeTab === 'overview' && stats && (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><Activity size={24} /></div>
                <div className="stat-content">
                  <span className="stat-value">{stats.overview.totalEvents}</span>
                  <span className="stat-label">Total Events</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Users size={24} /></div>
                <div className="stat-content">
                  <span className="stat-value">{stats.overview.uniqueVisitors}</span>
                  <span className="stat-label">Unique Visitors</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Terminal size={24} /></div>
                <div className="stat-content">
                  <span className="stat-value">{stats.overview.totalCommands}</span>
                  <span className="stat-label">Commands</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><MessageSquare size={24} /></div>
                <div className="stat-content">
                  <span className="stat-value">{stats.overview.totalChats}</span>
                  <span className="stat-label">Chat Messages</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Clock size={24} /></div>
                <div className="stat-content">
                  <span className="stat-value">{stats.overview.chatSessions}</span>
                  <span className="stat-label">Chat Sessions</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Globe size={24} /></div>
                <div className="stat-content">
                  <span className="stat-value">{stats.overview.totalVisits}</span>
                  <span className="stat-label">Page Visits</span>
                </div>
              </div>
            </section>

            <section className="charts-grid">
              <div className="chart-card">
                <h3>Top Commands</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.topCommands} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#3c3836" />
                    <XAxis type="number" stroke="#a89984" />
                    <YAxis dataKey="name" type="category" stroke="#a89984" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1d2021', border: '1px solid #3c3836' }} labelStyle={{ color: '#ebdbb2' }} />
                    <Bar dataKey="count" fill="#98971a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Hourly Activity</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3c3836" />
                    <XAxis dataKey="hour" stroke="#a89984" tickFormatter={(h) => `${h}:00`} />
                    <YAxis stroke="#a89984" />
                    <Tooltip contentStyle={{ backgroundColor: '#1d2021', border: '1px solid #3c3836' }} labelFormatter={(h) => `${h}:00`} />
                    <Line type="monotone" dataKey="count" stroke="#458588" strokeWidth={2} dot={{ fill: '#458588' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card full-width">
                <h3>Daily Activity</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3c3836" />
                    <XAxis dataKey="date" stroke="#a89984" />
                    <YAxis stroke="#a89984" />
                    <Tooltip contentStyle={{ backgroundColor: '#1d2021', border: '1px solid #3c3836' }} />
                    <Bar dataKey="count" fill="#b16286" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Event Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Visits', value: stats.overview.totalVisits },
                        { name: 'Commands', value: stats.overview.totalCommands },
                        { name: 'Chats', value: stats.overview.totalChats },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1d2021', border: '1px solid #3c3836' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}

        {activeTab === 'visitors' && visitors && (
          <section className="visitors-section-split">
            <div className="visitors-list">
              <h3>Visitors ({visitors.totalVisitors})</h3>
              <div className="visitors-table">
                <table>
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Location</th>
                      <th>Last Seen</th>
                      <th>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.visitors.map((visitor) => (
                      <tr
                        key={visitor.ip}
                        className={selectedVisitor === visitor.ip ? 'selected' : ''}
                        onClick={() => handleSelectVisitor(visitor.ip)}
                      >
                        <td className="ip">{visitor.ip}</td>
                        <td className="location">
                          {visitor.location ? (
                            <>
                              <MapPin size={14} />
                              <span>{visitor.location.city ? `${visitor.location.city}, ` : ''}{visitor.location.country}</span>
                            </>
                          ) : (
                            <span className="unknown">Unknown</span>
                          )}
                        </td>
                        <td className="time">{new Date(visitor.lastSeen).toLocaleString()}</td>
                        <td className="count">{visitor.totalEvents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="visitor-activity">
              {loadingActivity ? (
                <div className="loading-activity">Loading activity...</div>
              ) : selectedVisitor && visitorActivity ? (
                <>
                  <h3>Activity Timeline - {visitorActivity.ip}</h3>
                  {visitorActivity.location && (
                    <p className="visitor-location">
                      <MapPin size={14} />
                      {visitorActivity.location.city && `${visitorActivity.location.city}, `}
                      {visitorActivity.location.country}
                    </p>
                  )}
                  <p className="visitor-stats">
                    {visitorActivity.totalEvents} events in {visitorActivity.totalSessions} session(s)
                  </p>
                  <div className="sessions-timeline">
                    {visitorActivity.sessions.map((session, sessionIdx) => (
                      <div key={sessionIdx} className="session-block">
                        <div className="session-header-timeline">
                          <span className="session-date">{new Date(session.startTime).toLocaleDateString()}</span>
                          <span className="session-time-range">
                            {new Date(session.startTime).toLocaleTimeString()} - {new Date(session.endTime).toLocaleTimeString()}
                          </span>
                          <span className="session-summary">
                            {session.visits > 0 && `${session.visits} visit${session.visits > 1 ? 's' : ''}`}
                            {session.commands > 0 && ` · ${session.commands} cmd${session.commands > 1 ? 's' : ''}`}
                            {session.chats > 0 && ` · ${session.chats} chat${session.chats > 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div className="events-list">
                          {session.events.map((event, eventIdx) => (
                            <div key={eventIdx} className={`event-item event-${event.type}`}>
                              <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                              <span className={`event-type ${event.type}`}>{event.type}</span>
                              <span className="event-content">
                                {event.type === 'visit' && 'Page visit'}
                                {event.type === 'command' && event.command}
                                {event.type === 'chat' && (
                                  <span className="chat-preview">
                                    <strong>Q:</strong> {event.userMessage?.substring(0, 50)}{event.userMessage && event.userMessage.length > 50 ? '...' : ''}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  <Users size={48} />
                  <p>Select a visitor to see their activity</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'chats' && chats && (
          <section className="chats-section">
            <div className="sessions-list">
              <h3>Chat Sessions ({chats.sessions.length})</h3>
              {chats.sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className={`session-item ${selectedSession === session.sessionId ? 'active' : ''}`}
                  onClick={() => setSelectedSession(session.sessionId)}
                >
                  <div className="session-header">
                    <span className="session-ip">{session.ip}</span>
                    <span className="session-count">{session.messages.length} msgs</span>
                  </div>
                  <div className="session-time">{new Date(session.startTime).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="chat-viewer">
              {selectedSession ? (
                <>
                  <h3>Conversation</h3>
                  <div className="messages">
                    {chats.sessions
                      .find(s => s.sessionId === selectedSession)
                      ?.messages.map((msg, idx) => (
                        <div key={idx} className="message-pair">
                          <div className="user-message">
                            <span className="label">User:</span>
                            <p>{msg.userMessage}</p>
                            <span className="time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="bot-message">
                            <span className="label">Alfonso:</span>
                            <p>{msg.botResponse}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  <MessageSquare size={48} />
                  <p>Select a session to view the conversation</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'commands' && stats && (
          <section className="commands-section">
            <h3>Command Usage Statistics</h3>
            <div className="commands-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Command</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topCommands.map((cmd, idx) => (
                    <tr key={cmd.name}>
                      <td className="rank">#{idx + 1}</td>
                      <td className="command">{cmd.name}</td>
                      <td className="count">{cmd.count}</td>
                      <td className="percentage">
                        <div className="bar-container">
                          <div
                            className="bar"
                            style={{
                              width: `${(cmd.count / stats.topCommands[0].count) * 100}%`,
                              backgroundColor: COLORS[idx % COLORS.length]
                            }}
                          />
                          <span>{((cmd.count / stats.overview.totalCommands) * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer>
        <p>Terminal Site Analytics Dashboard - Built for alfonso.ridao.ar</p>
        <p className="last-updated">Last updated: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}

export default App;
