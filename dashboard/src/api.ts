const API_BASE = 'https://7sv2xijrq7.execute-api.eu-west-2.amazonaws.com/api';

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

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

export async function login(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  } catch {
    return { success: false, error: 'Connection failed' };
  }
}

async function fetchApi(endpoint: string) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/analytics${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
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

// ---------------------------------------------------------------------------
// Types returned by GET /analytics/dashboard
// ---------------------------------------------------------------------------

export type Site = 'terminal' | 'win95';

export type EventType =
  | 'visit' | 'command' | 'chat'
  | 'win-visit' | 'win-click' | 'win-window' | 'win-chat' | 'win-cv' | 'win-session';

export interface RawEvent {
  id: string;
  ts: string;
  ip: string;
  site: Site;
  type: EventType;
  sessionId?: string;
  // visit / win-visit
  userAgent?: string;
  referrer?: string;
  screenWidth?: number;
  screenHeight?: number;
  // command
  command?: string;
  // chat / win-chat
  userMessage?: string;
  botResponse?: string;
  // win-click
  element?: string;
  target?: string;
  // win-window / win-cv
  appName?: string;
  action?: string;
  pageNumber?: number;
  // win-session
  durationMs?: number;
}

export interface Geo {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  isp: string;
  org: string;
  as: string;
  proxy: boolean;
  hosting: boolean;
}

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  ts: string;
  ip: string;
  approved: boolean;
  seed: boolean;
}

export interface DashboardResponse {
  generatedAt: string;
  totalRawItems: number;
  events: RawEvent[];
  geo: Record<string, Geo>;
  guestbook: {
    visitorCount: number;
    entries: GuestbookEntry[];
    error?: string;
  };
}

export const api = {
  getDashboard: (): Promise<DashboardResponse> => fetchApi('/dashboard'),
};
