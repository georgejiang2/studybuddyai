import {
  createMatch,
  createSession,
  getActiveSessionForUser,
  getPartnerUserId,
  getProfile,
  getProfileSubjects,
  getQueueEntry,
  getSubjectOverlap,
  isProfileComplete,
  listMatchesForUser,
  listQueueEntries,
  normalizeString,
  removeQueueEntry,
} from "@/lib/studybuddy/store";
import { type MatchStatusResponse, type PartnerProfileSummary } from "@/lib/studybuddy/types";

const SUBJECT_STRICT_WINDOW_MS = 2 * 60 * 1000;
const MINIMUM_MATCH_SCORE = 45;

function getWaitDurationMs(queuedAt: string) {
  return Date.now() - new Date(queuedAt).getTime();
}

function majorSimilarity(majorA: string, majorB: string) {
  const normalizedA = normalizeString(majorA);
  const normalizedB = normalizeString(majorB);

  if (normalizedA === normalizedB) {
    return 20;
  }

  const tokensA = new Set(normalizedA.split(" "));
  const sharedTokens = normalizedB
    .split(" ")
    .filter((token) => tokensA.has(token));

  return sharedTokens.length > 0 ? 10 : 0;
}

function yearScore(yearA: string, yearB: string) {
  const order = ["freshman", "sophomore", "junior", "senior", "grad"];
  const indexA = order.indexOf(yearA);
  const indexB = order.indexOf(yearB);

  if (indexA < 0 || indexB < 0) {
    return 0;
  }

  const distance = Math.abs(indexA - indexB);
  if (distance === 0) {
    return 15;
  }
  if (distance === 1) {
    return 10;
  }
  if (distance === 2) {
    return 5;
  }
  return 0;
}

function waitBonus(waitMs: number) {
  return Math.min(15, Math.floor(waitMs / 30000));
}

function buildPartnerProfile(userId: string): PartnerProfileSummary | null {
  const profile = getProfile(userId);
  if (!profile) {
    return null;
  }

  return {
    userId,
    name: profile.name,
    school: profile.school,
    major: profile.major,
    year: profile.year,
    bio: profile.bio,
    subjects: getProfileSubjects(userId),
  };
}

function buildMatchReason(
  viewerId: string,
  partnerId: string,
  currentSubject: string,
  matchType: "same_subject" | "expanded",
) {
  const viewer = getProfile(viewerId);
  const partner = getProfile(partnerId);

  if (!viewer || !partner) {
    return matchType === "same_subject"
      ? `You are both studying ${currentSubject} right now.`
      : "No same-subject match was available, so we found the closest active student.";
  }

  if (matchType === "same_subject") {
    return `You are both studying ${currentSubject} right now and attend ${partner.school}.`;
  }

  const overlap = getSubjectOverlap(viewerId, partnerId);
  if (overlap.length > 0) {
    return `No same-subject match was available, so we matched you with another ${partner.school} student who also studies ${overlap[0]}.`;
  }

  return `No same-subject match was available, so we matched you with another ${partner.school} student in a similar academic lane.`;
}

export function findOrCreateMatch(userId: string): MatchStatusResponse {
  const queueEntry = getQueueEntry(userId);
  if (!queueEntry) {
    return {
      status: "idle",
      matchId: null,
      matchType: null,
      reason: null,
      partnerProfile: null,
      queuedAt: null,
      currentSubject: null,
      sessionId: null,
    };
  }

  const profile = getProfile(userId);
  if (!profile || !isProfileComplete(userId) || getActiveSessionForUser(userId)) {
    return {
      status: "waiting",
      matchId: null,
      matchType: null,
      reason: null,
      partnerProfile: null,
      queuedAt: queueEntry.queuedAt,
      currentSubject: queueEntry.currentSubject,
      sessionId: null,
    };
  }

  const waitedMs = getWaitDurationMs(queueEntry.queuedAt);
  const strictSubjectWindow = waitedMs < SUBJECT_STRICT_WINDOW_MS;
  const candidates = listQueueEntries().filter((candidate) => {
    if (candidate.userId === userId) {
      return false;
    }
    if (!isProfileComplete(candidate.userId) || getActiveSessionForUser(candidate.userId)) {
      return false;
    }
    if (strictSubjectWindow) {
      return candidate.normalizedCurrentSubject === queueEntry.normalizedCurrentSubject;
    }
    return true;
  });

  const ranked = candidates
    .map((candidate) => {
      const candidateProfile = getProfile(candidate.userId);
      if (!candidateProfile) {
        return null;
      }

      const sameSubject =
        candidate.normalizedCurrentSubject === queueEntry.normalizedCurrentSubject;
      const schoolScore =
        normalizeString(candidateProfile.school) === normalizeString(profile.school)
          ? 50
          : 0;
      const overlapCount = getSubjectOverlap(userId, candidate.userId).length;
      const score =
        (sameSubject ? 100 : 0) +
        schoolScore +
        majorSimilarity(profile.major, candidateProfile.major) +
        yearScore(profile.year, candidateProfile.year) +
        Math.min(24, overlapCount * 8) +
        waitBonus(waitedMs) +
        waitBonus(getWaitDurationMs(candidate.queuedAt));

      return {
        candidate,
        score,
        sameSubject,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < MINIMUM_MATCH_SCORE) {
    return {
      status: "waiting",
      matchId: null,
      matchType: null,
      reason: null,
      partnerProfile: null,
      queuedAt: queueEntry.queuedAt,
      currentSubject: queueEntry.currentSubject,
      sessionId: null,
    };
  }

  const matchType = best.sameSubject ? "same_subject" : "expanded";
  const reason = buildMatchReason(
    userId,
    best.candidate.userId,
    queueEntry.currentSubject,
    matchType,
  );
  const match = createMatch(userId, best.candidate.userId, matchType, reason);
  const session = createSession(match.id);

  removeQueueEntry(userId);
  removeQueueEntry(best.candidate.userId);

  return {
    status: "matched",
    matchId: match.id,
    matchType: match.matchType,
    reason: match.reason,
    partnerProfile: buildPartnerProfile(getPartnerUserId(match, userId)),
    queuedAt: null,
    currentSubject: queueEntry.currentSubject,
    sessionId: session.id,
  };
}

export function getUserMatchStatus(userId: string): MatchStatusResponse {
  const activeSession = getActiveSessionForUser(userId);
  const recentMatch = listMatchesForUser(userId)[0] ?? null;
  const queueEntry = getQueueEntry(userId);

  if (activeSession && recentMatch) {
    return {
      status: "in_session",
      matchId: recentMatch.id,
      matchType: recentMatch.matchType,
      reason: recentMatch.reason,
      partnerProfile: buildPartnerProfile(getPartnerUserId(recentMatch, userId)),
      queuedAt: null,
      currentSubject: null,
      sessionId: activeSession.id,
    };
  }

  if (recentMatch) {
    return {
      status: "matched",
      matchId: recentMatch.id,
      matchType: recentMatch.matchType,
      reason: recentMatch.reason,
      partnerProfile: buildPartnerProfile(getPartnerUserId(recentMatch, userId)),
      queuedAt: null,
      currentSubject: null,
      sessionId: null,
    };
  }

  if (queueEntry) {
    return {
      status: "waiting",
      matchId: null,
      matchType: null,
      reason: null,
      partnerProfile: null,
      queuedAt: queueEntry.queuedAt,
      currentSubject: queueEntry.currentSubject,
      sessionId: null,
    };
  }

  return {
    status: "idle",
    matchId: null,
    matchType: null,
    reason: null,
    partnerProfile: null,
    queuedAt: null,
    currentSubject: null,
    sessionId: null,
  };
}
