export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }

  return data as T;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface Profile {
  userId: string;
  name: string;
  school: string;
  major: string;
  year: string;
  bio: string;
}

export interface MeResponse {
  user: AuthUser;
  profile: Profile | null;
  subjects: string[] | null;
  profileCompleted: boolean;
  matchStatus: unknown;
  friendships: unknown[];
}

interface AuthResponse {
  user: AuthUser;
  profileCompleted: boolean;
}

export interface ProfileSetupPayload {
  name: string;
  school: string;
  major: string;
  year: string;
  bio: string;
  subjects: string[];
}

export interface MatchStatus {
  status: 'idle' | 'queued' | 'matched';
  matchId: string | null;
  reason: string | null;
  sessionId: string | null;
  currentSubject: string | null;
}

export const api = {
  signup(email: string, password: string) {
    return request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  me() {
    return request<MeResponse>('/api/me');
  },

  setupProfile(data: ProfileSetupPayload) {
    return request<{ user: AuthUser; profile: Profile; subjects: string[]; profileCompleted: boolean }>(
      '/api/auth/profile/setup',
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  startMatch(currentSubject: string) {
    return request<MatchStatus>('/api/match/start', {
      method: 'POST',
      body: JSON.stringify({ currentSubject }),
    });
  },

  matchStatus() {
    return request<MatchStatus>('/api/match/status');
  },

  cancelMatch() {
    return request<{ status: string }>('/api/match/cancel', {
      method: 'POST',
    });
  },
};
