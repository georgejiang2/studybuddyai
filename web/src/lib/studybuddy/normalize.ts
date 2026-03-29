import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Uses Claude Haiku to normalize a school name to its full official name.
 * Falls back to trimmed input if API is unavailable.
 */
export async function normalizeSchoolName(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const anthropic = getClient();
  if (!anthropic) return trimmed;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Normalize this college/university name to its full official name. Only respond with the normalized name, nothing else. If you don't recognize it, return the input as-is.

Input: "${trimmed}"`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : trimmed;

    return text || trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Uses Claude Haiku to normalize a major/field of study.
 * Falls back to trimmed input if API is unavailable.
 */
export async function normalizeMajorName(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const anthropic = getClient();
  if (!anthropic) return trimmed;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Normalize this college major/field of study to its standard full name. Only respond with the normalized name, nothing else. If you don't recognize it, return the input as-is.

Examples:
"CS" → "Computer Science"
"EE" → "Electrical Engineering"
"bio" → "Biology"
"polisci" → "Political Science"

Input: "${trimmed}"`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : trimmed;

    return text || trimmed;
  } catch {
    return trimmed;
  }
}
