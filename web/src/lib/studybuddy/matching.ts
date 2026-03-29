import {
  createMatch,
  createSession,
  getActiveSessionForUser,
  getPartnerUserId,
  getProfile,
  getProfileSubjects,
  getQueueEntry,
  getRecentlySkipped,
  isProfileComplete,
  listMatchesForUser,
  listQueueEntries,
  normalizeString,
  removeQueueEntry,
} from "@/lib/studybuddy/store";
import { type MatchStatusResponse, type PartnerProfileSummary } from "@/lib/studybuddy/types";

// ── Config ──────────────────────────────────────────────
const SUBJECT_STRICT_WINDOW_MS = 2 * 60 * 1000;
const MINIMUM_MATCH_SCORE = 0.25; // 0–1 scale

// Weights must sum to 1.0
const WEIGHTS = {
  currentSubject: 0.35,
  subjects: 0.25,
  school: 0.15,
  major: 0.15,
  year: 0.05,
  wait: 0.05,
};

// Filler words to strip from school/major names before tokenizing
const FILLER_WORDS = new Set([
  "of", "the", "and", "in", "at", "for", "a", "an",
  "university", "college", "institute", "school",
]);

// ── Similarity functions (all return 0–1) ───────────────

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeString(text)
      .split(/\s+/)
      .filter((w) => w.length > 0 && !FILLER_WORDS.has(w)),
  );
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 * Returns 0 if both sets are empty, 1 if identical.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Fuzzy Jaccard: for each token in A, find the best match in B
 * using prefix matching (covers "tech" → "technology").
 * Returns 0–1.
 */
function fuzzyJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  const bArr = Array.from(b);
  let matches = 0;
  const matched = new Set<string>();

  for (const tokenA of a) {
    let bestScore = 0;
    let bestMatch = "";
    for (const tokenB of bArr) {
      if (matched.has(tokenB)) continue;
      const score = tokenSimilarity(tokenA, tokenB);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = tokenB;
      }
    }
    if (bestScore >= 0.6) {
      matches++;
      matched.add(bestMatch);
    }
  }

  const union = a.size + b.size - matches;
  return union === 0 ? 0 : matches / union;
}

/**
 * Similarity between two tokens:
 * - Exact match → 1.0
 * - One is a prefix of the other (min 3 chars) → 0.8
 * - Edit distance ratio → 0–1
 */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  // Prefix match: "tech" matches "technology"
  if (a.length >= 3 && b.startsWith(a)) return 0.85;
  if (b.length >= 3 && a.startsWith(b)) return 0.85;
  // Edit distance similarity
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = editDistance(a, b);
  return 1 - dist / maxLen;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

async function subjectTokens(userId: string): Promise<Set<string>> {
  const subjects = await getProfileSubjects(userId);
  const tokens = new Set<string>();
  for (const subject of subjects) {
    for (const word of normalizeString(subject).split(/\s+/)) {
      if (word.length > 0) tokens.add(word);
    }
  }
  return tokens;
}

function yearSimilarity(yearA: string, yearB: string): number {
  const order = ["freshman", "sophomore", "junior", "senior", "grad"];
  const indexA = order.indexOf(yearA);
  const indexB = order.indexOf(yearB);
  if (indexA < 0 || indexB < 0) return 0;
  return 1 - Math.abs(indexA - indexB) / 4;
}

function waitSimilarity(queuedAt: string): number {
  const waitMs = Date.now() - new Date(queuedAt).getTime();
  return Math.min(1, waitMs / 180_000); // caps at 3 minutes
}

// ── Composite scoring ───────────────────────────────────

interface MatchScore {
  total: number;
  sameCurrentSubject: boolean;
  breakdown: {
    currentSubject: number;
    subjects: number;
    school: number;
    major: number;
    year: number;
    wait: number;
  };
}

async function computeMatchScore(
  userId: string,
  candidateId: string,
  userQueueSubject: string,
  candidateQueueSubject: string,
  userQueuedAt: string,
  candidateQueuedAt: string,
): Promise<MatchScore | null> {
  const profileA = await getProfile(userId);
  const profileB = await getProfile(candidateId);
  if (!profileA || !profileB) return null;

  const sameCurrentSubject =
    normalizeString(userQueueSubject) === normalizeString(candidateQueueSubject);

  const currentSubjectScore = sameCurrentSubject ? 1.0 : 0.0;

  // Jaccard on all subject word tokens
  const subjectsScore = jaccard(await subjectTokens(userId), await subjectTokens(candidateId));

  // Exact match on standardized school (from dropdown)
  const schoolScore =
    normalizeString(profileA.school) === normalizeString(profileB.school) ? 1.0 : 0.0;

  // Exact match on standardized major (from dropdown)
  const majorScore =
    normalizeString(profileA.major) === normalizeString(profileB.major) ? 1.0 : 0.0;

  const yearScore = yearSimilarity(profileA.year, profileB.year);

  // Average of both users' wait bonus
  const waitScore =
    (waitSimilarity(userQueuedAt) + waitSimilarity(candidateQueuedAt)) / 2;

  const total =
    WEIGHTS.currentSubject * currentSubjectScore +
    WEIGHTS.subjects * subjectsScore +
    WEIGHTS.school * schoolScore +
    WEIGHTS.major * majorScore +
    WEIGHTS.year * yearScore +
    WEIGHTS.wait * waitScore;

  return {
    total,
    sameCurrentSubject,
    breakdown: {
      currentSubject: currentSubjectScore,
      subjects: subjectsScore,
      school: schoolScore,
      major: majorScore,
      year: yearScore,
      wait: waitScore,
    },
  };
}

// ── Match reason builder ────────────────────────────────

async function buildMatchReason(
  userId: string,
  partnerId: string,
  currentSubject: string,
  score: MatchScore,
): Promise<string> {
  const partner = await getProfile(partnerId);
  if (!partner) return "You were matched based on your profiles.";

  const parts: string[] = [];

  if (score.breakdown.currentSubject === 1) {
    parts.push(`You're both studying ${currentSubject} right now`);
  }

  if (score.breakdown.school >= 0.5) {
    parts.push(`you both attend ${partner.school}`);
  }

  if (score.breakdown.major >= 0.5 && !parts.some((p) => p.includes("studying"))) {
    parts.push(`you're both ${partner.major} majors`);
  } else if (score.breakdown.major >= 0.5) {
    parts.push(`same major`);
  }

  if (score.breakdown.subjects > 0.1 && score.breakdown.currentSubject < 1) {
    const overlap = await getOverlappingSubjectNames(userId, partnerId);
    if (overlap.length > 0) {
      parts.push(`you both study ${overlap.slice(0, 2).join(" and ")}`);
    }
  }

  if (score.breakdown.year >= 0.75) {
    parts.push(`you're in the same academic year`);
  }

  if (parts.length === 0) {
    return `Matched with ${partner.name} based on your profiles.`;
  }

  // Capitalize first part, join with commas
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.join(", ") + `.`;
}

async function getOverlappingSubjectNames(userA: string, userB: string): Promise<string[]> {
  const originalA = await getProfileSubjects(userA);
  const subjectsA = originalA.map((s) => normalizeString(s));
  const subjectsB = new Set((await getProfileSubjects(userB)).map((s) => normalizeString(s)));
  const result: string[] = [];
  for (let i = 0; i < subjectsA.length; i++) {
    if (subjectsB.has(subjectsA[i])) {
      result.push(originalA[i]);
    }
  }
  return result;
}

// ── Partner profile builder ─────────────────────────────

async function buildPartnerProfile(userId: string): Promise<PartnerProfileSummary | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;

  return {
    userId,
    name: profile.name,
    school: profile.school,
    major: profile.major,
    year: profile.year,
    bio: profile.bio,
    subjects: await getProfileSubjects(userId),
  };
}

// ── Core matching logic ─────────────────────────────────

export async function findOrCreateMatch(userId: string): Promise<MatchStatusResponse> {
  const queueEntry = await getQueueEntry(userId);
  if (!queueEntry) {
    return idle();
  }

  const profile = await getProfile(userId);
  if (!profile || !(await isProfileComplete(userId)) || await getActiveSessionForUser(userId)) {
    return waiting(queueEntry.queuedAt, queueEntry.currentSubject);
  }

  const waitedMs = Date.now() - new Date(queueEntry.queuedAt).getTime();
  const strictSubjectWindow = waitedMs < SUBJECT_STRICT_WINDOW_MS;

  // Get recently skipped users to avoid immediate re-matching
  const recentlySkipped = await getRecentlySkipped(userId, 5);

  const allEntries = await listQueueEntries();
  const candidates: typeof allEntries = [];
  for (const c of allEntries) {
    if (c.userId === userId) continue;
    if (recentlySkipped.has(c.userId)) continue; // Skip cooldown
    if (!(await isProfileComplete(c.userId)) || await getActiveSessionForUser(c.userId)) continue;
    if (strictSubjectWindow) {
      if (c.normalizedCurrentSubject === queueEntry.normalizedCurrentSubject) {
        candidates.push(c);
      }
    } else {
      candidates.push(c);
    }
  }

  const scoredResults: { candidate: typeof allEntries[number]; score: MatchScore }[] = [];
  for (const c of candidates) {
    const score = await computeMatchScore(
      userId,
      c.userId,
      queueEntry.currentSubject,
      c.currentSubject,
      queueEntry.queuedAt,
      c.queuedAt,
    );
    if (score) {
      scoredResults.push({ candidate: c, score });
    }
  }
  scoredResults.sort((a, b) => b.score.total - a.score.total);

  const best = scoredResults[0];
  if (!best || best.score.total < MINIMUM_MATCH_SCORE) {
    return waiting(queueEntry.queuedAt, queueEntry.currentSubject);
  }

  const matchType = best.score.sameCurrentSubject ? "same_subject" : "expanded";
  const reason = await buildMatchReason(
    userId,
    best.candidate.userId,
    queueEntry.currentSubject,
    best.score,
  );

  const match = await createMatch(userId, best.candidate.userId, matchType, reason);
  const session = await createSession(match.id);

  await removeQueueEntry(userId);
  await removeQueueEntry(best.candidate.userId);

  return {
    status: "matched",
    matchId: match.id,
    matchType: match.matchType,
    reason: match.reason,
    partnerProfile: await buildPartnerProfile(getPartnerUserId(match, userId)),
    queuedAt: null,
    currentSubject: queueEntry.currentSubject,
    sessionId: session.id,
  };
}

export async function getUserMatchStatus(userId: string): Promise<MatchStatusResponse> {
  const activeSession = await getActiveSessionForUser(userId);
  const queueEntry = await getQueueEntry(userId);

  if (activeSession) {
    const matches = await listMatchesForUser(userId);
    const match = matches.find(
      (m) => m.id === activeSession.matchId,
    );
    if (match) {
      return {
        status: "in_session",
        matchId: match.id,
        matchType: match.matchType,
        reason: match.reason,
        partnerProfile: await buildPartnerProfile(getPartnerUserId(match, userId)),
        queuedAt: null,
        currentSubject: null,
        sessionId: activeSession.id,
      };
    }
  }

  if (queueEntry) {
    return waiting(queueEntry.queuedAt, queueEntry.currentSubject);
  }

  return idle();
}

// ── Helpers ─────────────────────────────────────────────

function idle(): MatchStatusResponse {
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

function waiting(queuedAt: string, currentSubject: string): MatchStatusResponse {
  return {
    status: "waiting",
    matchId: null,
    matchType: null,
    reason: null,
    partnerProfile: null,
    queuedAt,
    currentSubject,
    sessionId: null,
  };
}
