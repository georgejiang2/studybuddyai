export type AcademicYear =
  | "freshman"
  | "sophomore"
  | "junior"
  | "senior"
  | "grad";

export type MatchType = "same_subject" | "expanded" | "friend_call";

export type QueueStatus = "waiting";

export type SessionStatus = "active" | "ended";

export type FriendStatus = "pending" | "accepted" | "rejected";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSessionUser extends AuthUser {
  authSource: "cookie" | "header";
}

export interface Profile {
  userId: string;
  name: string;
  school: string;
  normalizedSchool: string;
  major: string;
  normalizedMajor: string;
  year: AcademicYear;
  bio: string;
  updatedAt: string;
}

export interface QueueEntry {
  userId: string;
  currentSubject: string;
  normalizedCurrentSubject: string;
  status: QueueStatus;
  queuedAt: string;
  lastSeenAt: string;
}

export interface MatchRecord {
  id: string;
  userA: string;
  userB: string;
  matchType: MatchType;
  reason: string;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  matchId: string;
  roomName: string;
  provider: "livekit";
  providerRoomId: string;
  status: SessionStatus;
  endReason: string | null;
  endedBy: string | null;
  createdAt: string;
}

export interface FriendRecord {
  id: string;
  requesterId: string;
  recipientId: string;
  status: FriendStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  friendshipId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
}

export interface SessionMessageRecord {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export type CallStatus = "ringing" | "accepted" | "declined" | "cancelled" | "ended";

export interface CallRecord {
  id: string;
  callerId: string;
  recipientId: string;
  matchId: string;
  sessionId: string;
  status: CallStatus;
  createdAt: string;
}

export interface ProfileSetupInput {
  name: string;
  school: string;
  normalizedSchool?: string;
  major: string;
  normalizedMajor?: string;
  year: AcademicYear;
  bio: string;
  subjects: string[];
}

export interface PartnerProfileSummary {
  userId: string;
  name: string;
  school: string;
  major: string;
  year: AcademicYear;
  bio: string;
  subjects: string[];
}

export interface MatchStatusResponse {
  status: "idle" | "waiting" | "matched" | "in_session";
  matchId: string | null;
  matchType: MatchType | null;
  reason: string | null;
  partnerProfile: PartnerProfileSummary | null;
  queuedAt: string | null;
  currentSubject: string | null;
  sessionId: string | null;
}
