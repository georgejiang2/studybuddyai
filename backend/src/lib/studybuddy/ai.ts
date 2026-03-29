/**
 * AI-powered study style classifier using Claude API.
 *
 * Analyzes a student's bio text and classifies them into 1–3 study styles
 * from a fixed taxonomy. These styles are used as an additional signal
 * in the matching algorithm so students with compatible study habits
 * get paired together.
 */

// The canonical set of study styles. Claude must pick from these exactly.
export const STUDY_STYLES = [
  "focused",       // Deep work, quiet study, minimal distractions, solo grinder
  "collaborative", // Group projects, shared notes, teamwork-oriented
  "social",        // Enjoys discussion, study groups, learning through conversation
  "competitive",   // Exam prep, grade-driven, accountability partner
  "casual",        // Relaxed pace, flexible schedule, low-pressure environment
  "teaching",      // Likes explaining concepts, tutoring, mentoring others
  "visual",        // Diagrams, whiteboards, video-based learning
  "cramming",      // Last-minute sessions, high-intensity short bursts
] as const;

export type StudyStyle = (typeof STUDY_STYLES)[number];

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Calls the Claude API (Anthropic Messages endpoint) directly via fetch.
 * Uses claude-3-5-haiku for speed and cost-efficiency.
 */
async function callClaude(messages: ClaudeMessage[], system: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 100,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown error");
    throw new Error(`Claude API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as ClaudeResponse;
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text?.trim() ?? "";
}

/**
 * Classifies a student's bio into 1–3 study styles using Claude.
 *
 * Returns an array of StudyStyle strings. If the API fails or the bio
 * is empty, returns a sensible default so matching still works.
 */
export async function classifyStudyStyles(bio: string, major?: string, year?: string): Promise<StudyStyle[]> {
  if (!bio || bio.trim().length < 3) {
    return ["collaborative"]; // safe default
  }

  const styleList = STUDY_STYLES.join(", ");

  const system = `You are a study style classifier. Classify a student into 1-3 study styles from ONLY this list:

- focused: Deep work, quiet study, minimal distractions, solo grinding, concentration, long uninterrupted sessions
- collaborative: Group projects, shared notes, teamwork, working together, pair programming, study partners
- social: Discussion-based, study groups, conversation, hanging out while studying, chatty, social learning
- competitive: Exam prep, grade-driven, accountability, rankings, challenges, pushing each other, motivated by competition
- casual: Relaxed, flexible, low-pressure, chill, no rush, easygoing pace
- teaching: Explaining concepts, tutoring, mentoring, helping others understand, teaching to learn
- visual: Diagrams, whiteboards, drawings, video-based, mind maps, visual aids, color coding
- cramming: Last-minute, high-intensity, short bursts, all-nighters, deadline-driven, finals week sprints

CRITICAL RULES:
1. If the student directly states or clearly describes a style (e.g. "I am focused" or "I like to cram"), you MUST include that exact style. Do not second-guess direct statements.
2. Only add additional styles if the bio clearly supports them. Do not add styles just to fill up to 3.
3. A short or simple bio like "I am focused" should return just that one style — do NOT pad with extras.
4. Return ONLY a comma-separated list of style names. No explanation, no extra words, no punctuation besides commas.

Examples:
"I am focused" → focused
"I like studying in groups and discussing problems" → social, collaborative
"I grind leetcode alone late at night for interviews" → focused, competitive
"I cram the night before every exam" → cramming
"I love whiteboards and explaining things to others" → visual, teaching
"Looking for someone to keep me accountable before finals" → competitive, cramming
"Chill study sessions, no pressure, just vibes" → casual, social
"I study best when I teach concepts back to my friends" → teaching, social, collaborative`;

  const userMsg = `Bio: "${bio}"${major ? `\nMajor: ${major}` : ""}${year ? `\nYear: ${year}` : ""}`;

  try {
    const response = await callClaude(
      [{ role: "user", content: userMsg }],
      system,
    );

    // Parse the response: expect comma-separated style names
    const parsed = response
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is StudyStyle => (STUDY_STYLES as readonly string[]).includes(s));

    if (parsed.length === 0) {
      console.warn("[AI] Claude returned no valid styles from:", response);
      return ["collaborative"];
    }

    return parsed.slice(0, 3); // cap at 3
  } catch (err) {
    console.error("[AI] Failed to classify study styles:", err);
    return ["collaborative"]; // graceful fallback
  }
}
