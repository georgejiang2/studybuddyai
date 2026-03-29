/**
 * AI-powered study style classifier using Groq API (Llama 3.1).
 *
 * Analyzes a student's bio text and classifies them into 1–3 study styles
 * from a fixed taxonomy. These styles are used as an additional signal
 * in the matching algorithm so students with compatible study habits
 * get paired together.
 */

export const STUDY_STYLES = [
  "focused",
  "collaborative",
  "social",
  "competitive",
  "casual",
  "teaching",
  "visual",
  "cramming",
] as const;

export type StudyStyle = (typeof STUDY_STYLES)[number];

interface GroqChoice {
  message: { role: string; content: string };
}

interface GroqResponse {
  choices?: GroqChoice[];
  error?: { message: string };
}

async function callGroq(system: string, userMsg: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      max_tokens: 50,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown error");
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as GroqResponse;
  if (data.error) {
    throw new Error(`Groq API error: ${data.error.message}`);
  }

  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Classifies a student's bio into 1–3 study styles using Groq (Llama 3.1).
 *
 * Returns an array of StudyStyle strings. If the API fails or the bio
 * is empty, returns a sensible default so matching still works.
 */
export async function classifyStudyStyles(bio: string, major?: string, year?: string): Promise<StudyStyle[]> {
  if (!bio || bio.trim().length < 3) {
    return ["collaborative"];
  }

  const styleList = STUDY_STYLES.join(", ");

  const system = `You are a study style classifier for a student matching platform. Read the student's bio carefully and classify them into 1-3 styles from this list: ${styleList}.

If the student directly mentions or describes a style by name, you must include it. Then also consider their major, year, and overall tone to infer any additional styles that would be a good fit. Try to return 2-3 styles when possible to improve matching — but every style you return must be justifiable from the bio, major, or year.

Return ONLY a comma-separated list of style names from the list. Nothing else.`;

  const userMsg = `Bio: "${bio}"${major ? `\nMajor: ${major}` : ""}${year ? `\nYear: ${year}` : ""}`;

  try {
    const response = await callGroq(system, userMsg);

    const parsed = response
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is StudyStyle => (STUDY_STYLES as readonly string[]).includes(s));

    if (parsed.length === 0) {
      console.warn("[AI] Groq returned no valid styles from:", response);
      return ["collaborative"];
    }

    return parsed.slice(0, 3);
  } catch (err) {
    console.error("[AI] Failed to classify study styles:", err);
    return ["collaborative"];
  }
}
