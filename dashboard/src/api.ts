const API_BASE = 'https://7sv2xijrq7.execute-api.eu-west-2.amazonaws.com/api';

// Token management
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    sessionStorage.setItem('analytics_token', token);
  } else {
    sessionStorage.removeItem('analytics_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = sessionStorage.getItem('analytics_token');
  }
  return authToken;
}

export function clearAuth() {
  authToken = null;
  sessionStorage.removeItem('analytics_token');
  sessionStorage.removeItem('analytics_authenticated');
}

// Login API
export async function login(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Login failed' };
    }

    const data = await response.json();
    setAuthToken(data.token);
    sessionStorage.setItem('analytics_authenticated', 'true');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Connection failed' };
  }
}

// Authenticated API fetch
async function fetchApi(endpoint: string) {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/analytics${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    clearAuth();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export interface Stats {
  overview: {
    totalEvents: number;
    totalVisits: number;
    totalCommands: number;
    totalChats: number;
    uniqueVisitors: number;
    chatSessions: number;
  };
  topCommands: { name: string; count: number }[];
  hourlyActivity: { hour: number; count: number }[];
  dailyActivity: { date: string; count: number }[];
}

export interface ChatMessage {
  userMessage: string;
  botResponse: string;
  timestamp: string;
}

export interface ChatSession {
  sessionId: string;
  ip: string;
  startTime: string;
  endTime: string;
  messages: ChatMessage[];
}

export interface ChatsResponse {
  totalChats: number;
  sessions: ChatSession[];
}

export interface Command {
  command: string;
  ip: string;
  timestamp: string;
}

export interface Visit {
  ip: string;
  timestamp: string;
  userAgent?: string;
  location?: string;
}

export interface GeoLocation {
  country: string;
  countryCode: string;
  city: string;
  region: string;
}

export interface Visitor {
  ip: string;
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
  visits: number;
  commands: number;
  chats: number;
  location: GeoLocation | null;
}

export interface VisitorsResponse {
  totalVisitors: number;
  visitors: Visitor[];
}

export interface ActivityEvent {
  type: 'visit' | 'command' | 'chat';
  timestamp: string;
  command?: string;
  userMessage?: string;
  botResponse?: string;
  sessionId?: string;
  userAgent?: string;
}

export interface VisitorSession {
  startTime: string;
  endTime: string;
  totalEvents: number;
  visits: number;
  commands: number;
  chats: number;
  events: ActivityEvent[];
}

export interface VisitorActivityResponse {
  ip: string;
  location: GeoLocation | null;
  totalEvents: number;
  totalSessions: number;
  sessions: VisitorSession[];
}

export const api = {
  getStats: (): Promise<Stats> => fetchApi('/stats'),
  getChats: (limit = 100): Promise<ChatsResponse> => fetchApi(`/chats?limit=${limit}`),
  getCommands: (limit = 100): Promise<{ commands: Command[] }> => fetchApi(`/commands?limit=${limit}`),
  getVisits: (limit = 100): Promise<{ visits: Visit[] }> => fetchApi(`/visits?limit=${limit}`),
  getVisitors: (): Promise<VisitorsResponse> => fetchApi('/visitors'),
  getVisitorActivity: (ip: string): Promise<VisitorActivityResponse> => fetchApi(`/visitor-activity?ip=${encodeURIComponent(ip)}`),
  getAll: (limit = 1000): Promise<{ total: number; items: any[] }> => fetchApi(`/all?limit=${limit}`),
};
