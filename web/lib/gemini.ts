type InlineImage = { data: string; mimeType: string };

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`Gemini returned no JSON object: ${cleaned.slice(0, 180)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function askGeminiJson<T>({
  prompt,
  images = [],
  temperature = 0.15,
}: {
  prompt: string;
  images?: InlineImage[];
  temperature?: number;
}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const image of images) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      cache: "no-store",
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 240)}`);
  }
  const body = await response.json();
  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("");
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return extractJson(text) as T;
}

export function parseDataImage(value: string): InlineImage | null {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  return match ? { mimeType: match[1]!, data: match[2]! } : null;
}
