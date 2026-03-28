import {
  type AcademicYear,
  type AuthUser,
  type FriendRecord,
  type MatchRecord,
  type MessageRecord,
  type Profile,
  type ProfileSetupInput,
  type QueueEntry,
  type SessionRecord,
  type SessionMessageRecord,
} from "@/lib/studybuddy/types";

interface StoreState {
  users: Map<string, AuthUser>;
  userPasswords: Map<string, string>;
  userIdsByEmail: Map<string, string>;
  profiles: Map<string, Profile>;
  profileSubjects: Map<string, string[]>;
  queue: Map<string, QueueEntry>;
  matches: Map<string, MatchRecord>;
  sessions: Map<string, SessionRecord>;
  friends: Map<string, FriendRecord>;
  messages: Map<string, MessageRecord>;
  sessionMessages: Map<string, SessionMessageRecord>;
}

const STORE_KEY = "__studybuddy_store__";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeYear(year: string): AcademicYear {
  const normalized = year.trim().toLowerCase();
  if (
    normalized === "freshman" ||
    normalized === "sophomore" ||
    normalized === "junior" ||
    normalized === "senior" ||
    normalized === "grad"
  ) {
    return normalized;
  }
  return "junior";
}

function createSeedState(): StoreState {
  const users = new Map<string, AuthUser>([
    ["demo-user-1", { id: "demo-user-1", email: "ava@studybuddy.dev" }],
    ["demo-user-2", { id: "demo-user-2", email: "miles@studybuddy.dev" }],
    ["demo-user-3", { id: "demo-user-3", email: "sofia@studybuddy.dev" }],
  ]);

  const profiles = new Map<string, Profile>([
    [
      "demo-user-1",
      {
        userId: "demo-user-1",
        name: "Ava Chen",
        school: "Georgia Tech",
        major: "Computer Science",
        year: "junior",
        bio: "Studying for systems and interview-heavy classes.",
        updatedAt: nowIso(),
      },
    ],
    [
      "demo-user-2",
      {
        userId: "demo-user-2",
        name: "Miles Carter",
        school: "Georgia Tech",
        major: "Computer Science",
        year: "junior",
        bio: "Best in focused sprint sessions with shared notes.",
        updatedAt: nowIso(),
      },
    ],
    [
      "demo-user-3",
      {
        userId: "demo-user-3",
        name: "Sofia Patel",
        school: "Emory University",
        major: "Mathematics",
        year: "senior",
        bio: "Looking for accountability and exam-prep sessions.",
        updatedAt: nowIso(),
      },
    ],
  ]);

  const profileSubjects = new Map<string, string[]>([
    ["demo-user-1", ["Data Structures", "Algorithms", "Operating Systems"]],
    ["demo-user-2", ["Data Structures", "Databases", "Computer Networks"]],
    ["demo-user-3", ["Calculus", "Linear Algebra", "Probability"]],
  ]);

  return {
    users,
    userPasswords: new Map<string, string>([
      ["demo-user-1", "demo12345"],
      ["demo-user-2", "demo12345"],
      ["demo-user-3", "demo12345"],
    ]),
    userIdsByEmail: new Map<string, string>([
      ["ava@studybuddy.dev", "demo-user-1"],
      ["miles@studybuddy.dev", "demo-user-2"],
      ["sofia@studybuddy.dev", "demo-user-3"],
    ]),
    profiles,
    profileSubjects,
    queue: new Map(),
    matches: new Map(),
    sessions: new Map(),
    friends: new Map(),
    messages: new Map(),
    sessionMessages: new Map(),
  };
}

function getState(): StoreState {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: StoreState;
  };

  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = createSeedState();
  }

  return globalStore[STORE_KEY];
}

export function ensureUser(id: string, email: string) {
  const state = getState();
  const existing = state.users.get(id);
  if (existing) {
    return existing;
  }
  const user = { id, email };
  state.users.set(id, user);
  state.userIdsByEmail.set(email.toLowerCase(), id);
  return user;
}

export function getUser(id: string) {
  return getState().users.get(id) ?? null;
}

export function getUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const userId = getState().userIdsByEmail.get(normalized);
  return userId ? getUser(userId) : null;
}

export function createUserAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = getUserByEmail(normalizedEmail);
  if (existing) {
    return null;
  }

  const state = getState();
  const user: AuthUser = {
    id: `user_${crypto.randomUUID()}`,
    email: normalizedEmail,
  };
  state.users.set(user.id, user);
  state.userIdsByEmail.set(normalizedEmail, user.id);
  state.userPasswords.set(user.id, password);
  return user;
}

export function validateUserCredentials(email: string, password: string) {
  const user = getUserByEmail(email);
  if (!user) {
    return null;
  }

  const savedPassword = getState().userPasswords.get(user.id);
  if (!savedPassword || savedPassword !== password) {
    return null;
  }

  return user;
}

export function getProfile(userId: string) {
  return getState().profiles.get(userId) ?? null;
}

export function getProfileSubjects(userId: string) {
  return [...(getState().profileSubjects.get(userId) ?? [])];
}

export function isProfileComplete(userId: string) {
  const profile = getProfile(userId);
  const subjects = getProfileSubjects(userId);
  return Boolean(
    profile &&
      profile.name &&
      profile.school &&
      profile.major &&
      profile.bio &&
      subjects.length > 0,
  );
}

export function upsertProfile(userId: string, input: ProfileSetupInput) {
  const state = getState();
  const profile: Profile = {
    userId,
    name: input.name.trim(),
    school: input.school.trim(),
    major: input.major.trim(),
    year: normalizeYear(input.year),
    bio: input.bio.trim(),
    updatedAt: nowIso(),
  };

  const uniqueSubjects = Array.from(
    new Set(
      input.subjects
        .map((subject) => subject.trim())
        .filter(Boolean),
    ),
  );

  state.profiles.set(userId, profile);
  state.profileSubjects.set(userId, uniqueSubjects);
  return {
    profile,
    subjects: uniqueSubjects,
  };
}

export function getQueueEntry(userId: string) {
  return getState().queue.get(userId) ?? null;
}

export function upsertQueueEntry(userId: string, currentSubject: string) {
  const state = getState();
  const existing = state.queue.get(userId);
  const timestamp = nowIso();
  const queueEntry: QueueEntry = {
    userId,
    currentSubject: currentSubject.trim(),
    normalizedCurrentSubject: normalizeSubject(currentSubject),
    status: "waiting",
    queuedAt: existing?.queuedAt ?? timestamp,
    lastSeenAt: timestamp,
  };
  state.queue.set(userId, queueEntry);
  return queueEntry;
}

export function removeQueueEntry(userId: string) {
  getState().queue.delete(userId);
}

export function listQueueEntries() {
  return Array.from(getState().queue.values());
}

export function createMatch(
  userA: string,
  userB: string,
  matchType: MatchRecord["matchType"],
  reason: string,
) {
  const state = getState();
  const match: MatchRecord = {
    id: makeId("match"),
    userA,
    userB,
    matchType,
    reason,
    createdAt: nowIso(),
  };
  state.matches.set(match.id, match);
  return match;
}

export function getMatch(matchId: string) {
  return getState().matches.get(matchId) ?? null;
}

export function listMatchesForUser(userId: string) {
  return Array.from(getState().matches.values())
    .filter((match) => match.userA === userId || match.userB === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createSession(matchId: string) {
  const state = getState();
  const session: SessionRecord = {
    id: makeId("session"),
    matchId,
    roomName: `studybuddy-${matchId.slice(-8)}`,
    provider: "livekit",
    providerRoomId: matchId,
    status: "active",
    createdAt: nowIso(),
  };
  state.sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string) {
  return getState().sessions.get(sessionId) ?? null;
}

export function getSessionByMatchId(matchId: string) {
  return (
    Array.from(getState().sessions.values()).find(
      (session) => session.matchId === matchId && session.status === "active",
    ) ?? null
  );
}

export function getActiveSessionForUser(userId: string) {
  const matches = listMatchesForUser(userId).map((match) => match.id);
  return (
    Array.from(getState().sessions.values()).find(
      (session) =>
        session.status === "active" && matches.includes(session.matchId),
    ) ?? null
  );
}

export function getFriendshipBetween(userA: string, userB: string) {
  return (
    Array.from(getState().friends.values()).find(
      (friend) =>
        (friend.requesterId === userA && friend.recipientId === userB) ||
        (friend.requesterId === userB && friend.recipientId === userA),
    ) ?? null
  );
}

export function createFriendRequest(requesterId: string, recipientId: string) {
  const state = getState();
  const timestamp = nowIso();
  const friend: FriendRecord = {
    id: makeId("friend"),
    requesterId,
    recipientId,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.friends.set(friend.id, friend);
  return friend;
}

export function updateFriendshipStatus(
  friendId: string,
  status: FriendRecord["status"],
) {
  const state = getState();
  const friend = state.friends.get(friendId);
  if (!friend) {
    return null;
  }
  const updated: FriendRecord = {
    ...friend,
    status,
    updatedAt: nowIso(),
  };
  state.friends.set(friendId, updated);
  return updated;
}

export function listFriendshipsForUser(userId: string) {
  return Array.from(getState().friends.values())
    .filter(
      (friend) => friend.requesterId === userId || friend.recipientId === userId,
    )
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function createMessage(
  friendshipId: string,
  senderId: string,
  recipientId: string,
  text: string,
) {
  const state = getState();
  const message: MessageRecord = {
    id: makeId("msg"),
    friendshipId,
    senderId,
    recipientId,
    text: text.trim(),
    createdAt: nowIso(),
  };
  state.messages.set(message.id, message);
  return message;
}

export function listMessagesForFriendship(friendshipId: string) {
  return Array.from(getState().messages.values())
    .filter((message) => message.friendshipId === friendshipId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

export function getPartnerUserId(match: MatchRecord, userId: string) {
  return match.userA === userId ? match.userB : match.userA;
}

export function normalizeString(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hasSavedSubject(userId: string, subject: string) {
  const normalized = normalizeSubject(subject);
  return getProfileSubjects(userId).some(
    (savedSubject) => normalizeSubject(savedSubject) === normalized,
  );
}

export function getSubjectOverlap(userA: string, userB: string) {
  const subjectsA = new Set(getProfileSubjects(userA).map(normalizeSubject));
  const subjectsB = getProfileSubjects(userB).map(normalizeSubject);
  return subjectsB.filter((subject) => subjectsA.has(subject));
}

export function endSession(sessionId: string) {
  const state = getState();
  const session = state.sessions.get(sessionId);
  if (!session) return null;
  const updated: SessionRecord = { ...session, status: "ended" };
  state.sessions.set(sessionId, updated);
  return updated;
}

export function createSessionMessage(
  sessionId: string,
  senderId: string,
  senderName: string,
  text: string,
) {
  const state = getState();
  const message: SessionMessageRecord = {
    id: makeId("smsg"),
    sessionId,
    senderId,
    senderName,
    text: text.trim(),
    createdAt: nowIso(),
  };
  state.sessionMessages.set(message.id, message);
  return message;
}

export function listSessionMessages(sessionId: string) {
  return Array.from(getState().sessionMessages.values())
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}
