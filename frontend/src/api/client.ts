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

export interface PartnerProfile {
  userId: string;
  name: string;
  school: string;
  major: string;
  year: string;
  bio: string;
  subjects: string[];
  studyStyles?: string[];
}

export interface MeResponse {
  user: AuthUser;
  profile: Profile | null;
  subjects: string[] | null;
  studyStyles: string[] | null;
  profileCompleted: boolean;
  matchStatus: MatchStatus;
  friendships: Friendship[];
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
  status: 'idle' | 'waiting' | 'matched' | 'in_session';
  matchId: string | null;
  matchType: string | null;
  reason: string | null;
  partnerProfile: PartnerProfile | null;
  queuedAt: string | null;
  currentSubject: string | null;
  sessionId: string | null;
}

export interface SessionJoinPayload {
  sessionId: string;
  roomName: string;
  token: string;
  livekitUrl: string;
  partnerId: string;
  matchReason: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
  partnerProfile?: Profile | null;
}

export interface FriendMessage {
  id: string;
  friendshipId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
}

export interface CallRecord {
  id: string;
  callerId: string;
  recipientId: string;
  matchId: string;
  sessionId: string;
  status: 'ringing' | 'accepted' | 'declined' | 'cancelled' | 'ended';
  createdAt: string;
}

export interface CallerProfile {
  name: string;
  school: string;
  major: string;
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

  // Matching
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

  // Sessions
  joinSession(params: { sessionId?: string; matchId?: string }) {
    return request<SessionJoinPayload>('/api/session/create-or-join', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  endSession(sessionId: string) {
    return request<{ session: unknown }>('/api/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  getSessionStatus(sessionId: string) {
    return request<{ status: string; endReason: string | null; endedBy: string | null; skippedByPartner: boolean }>(
      `/api/session/status?sessionId=${sessionId}`,
    );
  },

  skipSession(sessionId: string) {
    return request<{ session: unknown }>('/api/session/skip', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  getSessionMessages(sessionId: string) {
    return request<{ messages: SessionMessage[] }>(`/api/session/messages?sessionId=${sessionId}`);
  },

  sendSessionMessage(sessionId: string, text: string) {
    return request<{ message: SessionMessage }>('/api/session/messages', {
      method: 'POST',
      body: JSON.stringify({ sessionId, text }),
    });
  },

  // Friends
  getFriends() {
    return request<{ friendships: Friendship[] }>('/api/friends');
  },

  sendFriendRequest(recipientId: string) {
    return request<{ friendship: Friendship }>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    });
  },

  respondFriendRequest(friendshipId: string, action: 'accept' | 'reject') {
    return request<{ friendship: Friendship }>('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendshipId, action }),
    });
  },

  // Friend Chat
  getFriendChat(friendId: string) {
    return request<{ friendship: Friendship; messages: FriendMessage[] }>(`/api/chat/${friendId}`);
  },

  sendFriendMessage(friendId: string, text: string) {
    return request<{ message: FriendMessage }>(`/api/chat/${friendId}`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // Friend Calls
  startFriendCall(recipientId: string) {
    return request<{ call: CallRecord }>('/api/friends/call', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    });
  },

  getIncomingCall() {
    return request<{ call: CallRecord | null; callerProfile: CallerProfile | null }>('/api/friends/incoming-call');
  },

  respondToCall(callId: string, action: 'accept' | 'decline') {
    return request<{ call: CallRecord; sessionJoinPayload?: SessionJoinPayload }>('/api/friends/call/respond', {
      method: 'POST',
      body: JSON.stringify({ callId, action }),
    });
  },

  cancelCall(callId: string) {
    return request<{ call: CallRecord }>('/api/friends/call/cancel', {
      method: 'POST',
      body: JSON.stringify({ callId }),
    });
  },

  removeFriend(friendshipId: string) {
    return request<{ success: boolean }>('/api/friends/remove', {
      method: 'POST',
      body: JSON.stringify({ friendshipId }),
    });
  },

  getCallStatus(callId: string) {
    return request<{ call: CallRecord; sessionJoinPayload?: SessionJoinPayload; partnerProfile?: PartnerProfile | null }>(`/api/friends/call/status?callId=${callId}`);
  },
};
