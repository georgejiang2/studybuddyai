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

  const system = `You are a study style classifier for a student matching platform. Read the student's bio carefully and classify them into 1-3 styles from this list: ${styleList}.

If the student directly mentions or describes a style by name, you must include it. Then also consider their major, year, and overall tone to infer any additional styles that would be a good fit. Try to return 2-3 styles when possible to improve matching — but every style you return must be justifiable from the bio, major, or year.

Return ONLY a comma-separated list of style names from the list. Nothing else.`;

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
