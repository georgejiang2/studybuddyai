import { query } from "@/lib/studybuddy/db";
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
  type CallRecord,
  type CallStatus,
} from "@/lib/studybuddy/types";

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
  if (["freshman", "sophomore", "junior", "senior", "grad"].includes(normalized)) {
    return normalized as AcademicYear;
  }
  return "junior";
}

// ── Users ──────────────────────────────────────────────

export async function ensureUser(id: string, email: string): Promise<AuthUser> {
  await query(
    "INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [id, email.toLowerCase()],
  );
  return { id, email };
}

export async function getUser(id: string): Promise<AuthUser | null> {
  const res = await query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE id = $1",
    [id],
  );
  return res.rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const res = await query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE LOWER(email) = $1",
    [email.trim().toLowerCase()],
  );
  return res.rows[0] ?? null;
}

export async function createUserAccount(email: string, password: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const existing = await getUserByEmail(normalized);
  if (existing) return null;

  const id = `user_${crypto.randomUUID()}`;
  await query("INSERT INTO users (id, email) VALUES ($1, $2)", [id, normalized]);
  await query("INSERT INTO user_passwords (user_id, password) VALUES ($1, $2)", [id, password]);
  return { id, email: normalized };
}

export async function validateUserCredentials(email: string, password: string): Promise<AuthUser | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const res = await query<{ password: string }>(
    "SELECT password FROM user_passwords WHERE user_id = $1",
    [user.id],
  );
  if (!res.rows[0] || res.rows[0].password !== password) return null;
  return user;
}

// ── Profiles ───────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const res = await query<{
    user_id: string; name: string; school: string; normalized_school: string;
    major: string; normalized_major: string; year: AcademicYear; bio: string; updated_at: string;
  }>("SELECT * FROM profiles WHERE user_id = $1", [userId]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    name: row.name,
    school: row.school,
    normalizedSchool: row.normalized_school,
    major: row.major,
    normalizedMajor: row.normalized_major,
    year: row.year,
    bio: row.bio,
    updatedAt: row.updated_at,
  };
}

export async function getProfileSubjects(userId: string): Promise<string[]> {
  const res = await query<{ subject: string }>(
    "SELECT subject FROM profile_subjects WHERE user_id = $1 ORDER BY id",
    [userId],
  );
  return res.rows.map((r) => r.subject);
}

export async function isProfileComplete(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  const subjects = await getProfileSubjects(userId);
  return Boolean(
    profile && profile.name && profile.school && profile.major && profile.bio && subjects.length > 0,
  );
}

export async function upsertProfile(userId: string, input: ProfileSetupInput) {
  const year = normalizeYear(input.year);
  await query(
    `INSERT INTO profiles (user_id, name, school, normalized_school, major, normalized_major, year, bio, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       name = $2, school = $3, normalized_school = $4, major = $5,
       normalized_major = $6, year = $7, bio = $8, updated_at = NOW()`,
    [userId, input.name.trim(), input.school.trim(), (input.normalizedSchool ?? input.school).trim(),
     input.major.trim(), (input.normalizedMajor ?? input.major).trim(), year, input.bio.trim()],
  );

  // Replace subjects
  await query("DELETE FROM profile_subjects WHERE user_id = $1", [userId]);
  const uniqueSubjects = [...new Set(input.subjects.map((s) => s.trim()).filter(Boolean))];
  for (const subject of uniqueSubjects) {
    await query(
      "INSERT INTO profile_subjects (user_id, subject) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, subject],
    );
  }

  return { profile: await getProfile(userId), subjects: uniqueSubjects };
}

// ── Queue ──────────────────────────────────────────────

export async function getQueueEntry(userId: string): Promise<QueueEntry | null> {
  const res = await query<{
    user_id: string; current_subject: string; normalized_current_subject: string;
    status: string; queued_at: string; last_seen_at: string;
  }>("SELECT * FROM queue WHERE user_id = $1", [userId]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    currentSubject: row.current_subject,
    normalizedCurrentSubject: row.normalized_current_subject,
    status: "waiting",
    queuedAt: row.queued_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function upsertQueueEntry(userId: string, currentSubject: string): Promise<QueueEntry> {
  const normalized = normalizeSubject(currentSubject);
  await query(
    `INSERT INTO queue (user_id, current_subject, normalized_current_subject, status, queued_at, last_seen_at)
     VALUES ($1, $2, $3, 'waiting', NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       current_subject = $2, normalized_current_subject = $3, last_seen_at = NOW()`,
    [userId, currentSubject.trim(), normalized],
  );
  return (await getQueueEntry(userId))!;
}

export async function removeQueueEntry(userId: string) {
  await query("DELETE FROM queue WHERE user_id = $1", [userId]);
}

export async function listQueueEntries(): Promise<QueueEntry[]> {
  const res = await query<{
    user_id: string; current_subject: string; normalized_current_subject: string;
    status: string; queued_at: string; last_seen_at: string;
  }>("SELECT * FROM queue");
  return res.rows.map((row) => ({
    userId: row.user_id,
    currentSubject: row.current_subject,
    normalizedCurrentSubject: row.normalized_current_subject,
    status: "waiting" as const,
    queuedAt: row.queued_at,
    lastSeenAt: row.last_seen_at,
  }));
}

// ── Matches ────────────────────────────────────────────

export async function createMatch(
  userA: string, userB: string, matchType: MatchRecord["matchType"], reason: string,
): Promise<MatchRecord> {
  const id = makeId("match");
  const now = nowIso();
  await query(
    "INSERT INTO matches (id, user_a, user_b, match_type, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, userA, userB, matchType, reason, now],
  );
  return { id, userA, userB, matchType, reason, createdAt: now };
}

export async function getMatch(matchId: string): Promise<MatchRecord | null> {
  const res = await query<{
    id: string; user_a: string; user_b: string; match_type: string; reason: string; created_at: string;
  }>("SELECT * FROM matches WHERE id = $1", [matchId]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id, userA: row.user_a, userB: row.user_b,
    matchType: row.match_type as MatchRecord["matchType"],
    reason: row.reason, createdAt: row.created_at,
  };
}

export async function listMatchesForUser(userId: string): Promise<MatchRecord[]> {
  const res = await query<{
    id: string; user_a: string; user_b: string; match_type: string; reason: string; created_at: string;
  }>("SELECT * FROM matches WHERE user_a = $1 OR user_b = $1 ORDER BY created_at DESC", [userId]);
  return res.rows.map((row) => ({
    id: row.id, userA: row.user_a, userB: row.user_b,
    matchType: row.match_type as MatchRecord["matchType"],
    reason: row.reason, createdAt: row.created_at,
  }));
}

// ── Sessions ───────────────────────────────────────────

export async function createSession(matchId: string): Promise<SessionRecord> {
  const id = makeId("session");
  const roomName = `studybuddy-${matchId.slice(-8)}`;
  const now = nowIso();
  await query(
    "INSERT INTO sessions (id, match_id, room_name, provider, provider_room_id, status, created_at) VALUES ($1,$2,$3,'livekit',$2,'active',$4)",
    [id, matchId, roomName, now],
  );
  return { id, matchId, roomName, provider: "livekit", providerRoomId: matchId, status: "active", endReason: null, endedBy: null, createdAt: now };
}

type SessionRow = {
  id: string; match_id: string; room_name: string; provider: string;
  provider_room_id: string; status: string; end_reason: string | null;
  ended_by: string | null; created_at: string;
};

function mapSessionRow(row: SessionRow): SessionRecord {
  return {
    id: row.id, matchId: row.match_id, roomName: row.room_name,
    provider: "livekit", providerRoomId: row.provider_room_id,
    status: row.status as SessionRecord["status"],
    endReason: row.end_reason ?? null, endedBy: row.ended_by ?? null,
    createdAt: row.created_at,
  };
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const res = await query<SessionRow>("SELECT * FROM sessions WHERE id = $1", [sessionId]);
  return res.rows[0] ? mapSessionRow(res.rows[0]) : null;
}

export async function getSessionByMatchId(matchId: string): Promise<SessionRecord | null> {
  const res = await query<SessionRow>("SELECT * FROM sessions WHERE match_id = $1 AND status = 'active' LIMIT 1", [matchId]);
  return res.rows[0] ? mapSessionRow(res.rows[0]) : null;
}

export async function getActiveSessionForUser(userId: string): Promise<SessionRecord | null> {
  const res = await query<SessionRow>(
    `SELECT s.* FROM sessions s
     JOIN matches m ON s.match_id = m.id
     WHERE s.status = 'active' AND (m.user_a = $1 OR m.user_b = $1)
     LIMIT 1`,
    [userId],
  );
  return res.rows[0] ? mapSessionRow(res.rows[0]) : null;
}

export async function endSession(sessionId: string, endReason?: string, endedBy?: string): Promise<SessionRecord | null> {
  await query(
    "UPDATE sessions SET status = 'ended', end_reason = COALESCE($2, end_reason), ended_by = COALESCE($3, ended_by) WHERE id = $1",
    [sessionId, endReason ?? null, endedBy ?? null],
  );
  return getSession(sessionId);
}

// ── Friends ────────────────────────────────────────────

export async function getFriendshipBetween(userA: string, userB: string): Promise<FriendRecord | null> {
  const res = await query<{
    id: string; requester_id: string; recipient_id: string; status: string;
    created_at: string; updated_at: string;
  }>(
    `SELECT * FROM friends WHERE
      (requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1)
     LIMIT 1`,
    [userA, userB],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id, requesterId: row.requester_id, recipientId: row.recipient_id,
    status: row.status as FriendRecord["status"],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function createFriendRequest(requesterId: string, recipientId: string): Promise<FriendRecord> {
  const id = makeId("friend");
  const now = nowIso();
  await query(
    "INSERT INTO friends (id, requester_id, recipient_id, status, created_at, updated_at) VALUES ($1,$2,$3,'pending',$4,$4)",
    [id, requesterId, recipientId, now],
  );
  return { id, requesterId, recipientId, status: "pending", createdAt: now, updatedAt: now };
}

export async function updateFriendshipStatus(friendId: string, status: FriendRecord["status"]): Promise<FriendRecord | null> {
  await query("UPDATE friends SET status = $1, updated_at = NOW() WHERE id = $2", [status, friendId]);
  const res = await query<{
    id: string; requester_id: string; recipient_id: string; status: string;
    created_at: string; updated_at: string;
  }>("SELECT * FROM friends WHERE id = $1", [friendId]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id, requesterId: row.requester_id, recipientId: row.recipient_id,
    status: row.status as FriendRecord["status"],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listFriendshipsForUser(userId: string): Promise<FriendRecord[]> {
  const res = await query<{
    id: string; requester_id: string; recipient_id: string; status: string;
    created_at: string; updated_at: string;
  }>(
    "SELECT * FROM friends WHERE requester_id = $1 OR recipient_id = $1 ORDER BY updated_at DESC",
    [userId],
  );
  return res.rows.map((row) => ({
    id: row.id, requesterId: row.requester_id, recipientId: row.recipient_id,
    status: row.status as FriendRecord["status"],
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

export async function deleteFriendship(friendshipId: string): Promise<void> {
  // Delete messages associated with this friendship first
  await query("DELETE FROM messages WHERE friendship_id = $1", [friendshipId]);
  await query("DELETE FROM friends WHERE id = $1", [friendshipId]);
}

// ── Study Styles ──────────────────────────────────────

export async function getStudyStyles(userId: string): Promise<string[]> {
  const res = await query<{ style: string }>(
    "SELECT style FROM study_styles WHERE user_id = $1 ORDER BY id",
    [userId],
  );
  return res.rows.map((r) => r.style);
}

export async function upsertStudyStyles(userId: string, styles: string[]): Promise<string[]> {
  await query("DELETE FROM study_styles WHERE user_id = $1", [userId]);
  const unique = [...new Set(styles.map((s) => s.trim().toLowerCase()).filter(Boolean))];
  for (const style of unique) {
    await query(
      "INSERT INTO study_styles (user_id, style) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, style],
    );
  }
  return unique;
}

// ── Messages ───────────────────────────────────────────

export async function createMessage(
  friendshipId: string, senderId: string, recipientId: string, text: string,
): Promise<MessageRecord> {
  const id = makeId("msg");
  const now = nowIso();
  await query(
    "INSERT INTO messages (id, friendship_id, sender_id, recipient_id, text, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, friendshipId, senderId, recipientId, text.trim(), now],
  );
  return { id, friendshipId, senderId, recipientId, text: text.trim(), createdAt: now };
}

export async function listMessagesForFriendship(friendshipId: string): Promise<MessageRecord[]> {
  const res = await query<{
    id: string; friendship_id: string; sender_id: string; recipient_id: string;
    text: string; created_at: string;
  }>("SELECT * FROM messages WHERE friendship_id = $1 ORDER BY created_at ASC", [friendshipId]);
  return res.rows.map((row) => ({
    id: row.id, friendshipId: row.friendship_id, senderId: row.sender_id,
    recipientId: row.recipient_id, text: row.text, createdAt: row.created_at,
  }));
}

// ── Session Messages ───────────────────────────────────

export async function createSessionMessage(
  sessionId: string, senderId: string, senderName: string, text: string,
): Promise<SessionMessageRecord> {
  const id = makeId("smsg");
  const now = nowIso();
  await query(
    "INSERT INTO session_messages (id, session_id, sender_id, sender_name, text, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, sessionId, senderId, senderName, text.trim(), now],
  );
  return { id, sessionId, senderId, senderName, text: text.trim(), createdAt: now };
}

export async function listSessionMessages(sessionId: string): Promise<SessionMessageRecord[]> {
  const res = await query<{
    id: string; session_id: string; sender_id: string; sender_name: string;
    text: string; created_at: string;
  }>("SELECT * FROM session_messages WHERE session_id = $1 ORDER BY created_at ASC", [sessionId]);
  return res.rows.map((row) => ({
    id: row.id, sessionId: row.session_id, senderId: row.sender_id,
    senderName: row.sender_name, text: row.text, createdAt: row.created_at,
  }));
}

// ── Utility ────────────────────────────────────────────

export function getPartnerUserId(match: MatchRecord, userId: string) {
  return match.userA === userId ? match.userB : match.userA;
}

export function normalizeString(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function hasSavedSubject(userId: string, subject: string): Promise<boolean> {
  const subjects = await getProfileSubjects(userId);
  const normalized = normalizeSubject(subject);
  return subjects.some((s) => normalizeSubject(s) === normalized);
}

export async function getSubjectOverlap(userA: string, userB: string): Promise<string[]> {
  const subjectsA = new Set((await getProfileSubjects(userA)).map(normalizeSubject));
  const subjectsB = (await getProfileSubjects(userB)).map(normalizeSubject);
  return subjectsB.filter((s) => subjectsA.has(s));
}

// ── Calls ──────────────────────────────────────────────

function mapCallRow(row: {
  id: string; caller_id: string; recipient_id: string; match_id: string;
  session_id: string; status: string; created_at: string;
}): CallRecord {
  return {
    id: row.id, callerId: row.caller_id, recipientId: row.recipient_id,
    matchId: row.match_id, sessionId: row.session_id,
    status: row.status as CallStatus, createdAt: row.created_at,
  };
}

export async function createCall(
  callerId: string, recipientId: string, matchId: string, sessionId: string,
): Promise<CallRecord> {
  const id = makeId("call");
  const now = nowIso();
  await query(
    "INSERT INTO calls (id, caller_id, recipient_id, match_id, session_id, status, created_at) VALUES ($1,$2,$3,$4,$5,'ringing',$6)",
    [id, callerId, recipientId, matchId, sessionId, now],
  );
  return { id, callerId, recipientId, matchId, sessionId, status: "ringing", createdAt: now };
}

export async function getCall(callId: string): Promise<CallRecord | null> {
  const res = await query<{
    id: string; caller_id: string; recipient_id: string; match_id: string;
    session_id: string; status: string; created_at: string;
  }>("SELECT * FROM calls WHERE id = $1", [callId]);
  return res.rows[0] ? mapCallRow(res.rows[0]) : null;
}

export async function getIncomingCall(recipientId: string): Promise<CallRecord | null> {
  const res = await query<{
    id: string; caller_id: string; recipient_id: string; match_id: string;
    session_id: string; status: string; created_at: string;
  }>("SELECT * FROM calls WHERE recipient_id = $1 AND status = 'ringing' ORDER BY created_at DESC LIMIT 1", [recipientId]);
  return res.rows[0] ? mapCallRow(res.rows[0]) : null;
}

export async function getOutgoingCall(callerId: string): Promise<CallRecord | null> {
  const res = await query<{
    id: string; caller_id: string; recipient_id: string; match_id: string;
    session_id: string; status: string; created_at: string;
  }>("SELECT * FROM calls WHERE caller_id = $1 AND status = 'ringing' ORDER BY created_at DESC LIMIT 1", [callerId]);
  return res.rows[0] ? mapCallRow(res.rows[0]) : null;
}

export async function updateCallStatus(callId: string, status: CallStatus): Promise<CallRecord | null> {
  await query("UPDATE calls SET status = $1 WHERE id = $2", [status, callId]);
  return getCall(callId);
}

export async function expireStaleRingingCalls(): Promise<void> {
  await query("UPDATE calls SET status = 'cancelled' WHERE status = 'ringing' AND created_at < NOW() - INTERVAL '60 seconds'");
}

// ── Skips ──────────────────────────────────────────────

export async function recordSkip(skipperId: string, skippedId: string): Promise<void> {
  await query(
    "INSERT INTO skips (skipper_id, skipped_id, created_at) VALUES ($1, $2, NOW())",
    [skipperId, skippedId],
  );
}

export async function getRecentlySkipped(userId: string, withinMinutes = 5): Promise<Set<string>> {
  const res = await query<{ skipped_id: string }>(
    `SELECT DISTINCT skipped_id FROM skips
     WHERE skipper_id = $1 AND created_at > NOW() - INTERVAL '${withinMinutes} minutes'`,
    [userId],
  );
  return new Set(res.rows.map((r) => r.skipped_id));
}

export async function endCallBySessionId(sessionId: string): Promise<void> {
  await query("UPDATE calls SET status = 'ended' WHERE session_id = $1 AND status = 'accepted'", [sessionId]);
}
