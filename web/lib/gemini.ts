type InlineImage = { data: string; mimeType: string };

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = Array.from(
  new Set([
    PRIMARY_MODEL,
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
  ]),
);

// Cache models that recently returned 429 or 404 so consecutive requests skip straight to a healthy model
const modelCooldownUntil = new Map<string, number>();
const unavailableModels = new Set<string>();

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  if (start < 0) {
    throw new Error(`Gemini returned no JSON object: ${cleaned.slice(0, 180)}`);
  }
  const end = cleaned.lastIndexOf("}");
  if (end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // Fall through to truncated array recovery below
    }
  }
  // If output was truncated mid-array (e.g. {"outfits":[{...},{...},{"formula":...),
  // salvage all complete objects up to the last balanced "}".
  let searchEnd = cleaned.length;
  while (searchEnd > start) {
    const candidateClose = cleaned.lastIndexOf("}", searchEnd - 1);
    if (candidateClose <= start) break;
    const prefix = cleaned.slice(start, candidateClose + 1);
    for (const suffix of ["", "]}", "]}"]) {
      try {
        return JSON.parse(prefix + suffix);
      } catch {
        // try earlier closing brace
      }
    }
    searchEnd = candidateClose;
  }
  throw new Error(`Gemini returned no JSON object: ${cleaned.slice(0, 180)}`);
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function askGeminiJson<T>({
  prompt,
  images = [],
  temperature = 0.15,
  responseSchema,
}: {
  prompt: string;
  images?: InlineImage[];
  temperature?: number;
  responseSchema?: Record<string, unknown>;
}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const image of images) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  const now = Date.now();
  const activeModels = FALLBACK_MODELS.filter((m) => !unavailableModels.has(m));
  const orderedModels = [
    ...activeModels.filter((m) => (modelCooldownUntil.get(m) ?? 0) <= now),
    ...activeModels.filter((m) => (modelCooldownUntil.get(m) ?? 0) > now),
  ];

  let lastError = "Gemini request failed";
  let lastQuotaError: string | null = null;

  for (const model of orderedModels) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        cache: "no-store",
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            ...(responseSchema ? { responseSchema } : {}),
            ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 512 } } : {}),
            temperature,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      const formattedError = `Gemini (${model}) ${response.status}: ${detail.slice(0, 220)}`;
      if (response.status === 404) {
        unavailableModels.add(model);
        lastError = formattedError;
        continue;
      }
      if (response.status === 429 || response.status === 503) {
        lastQuotaError = formattedError;
        lastError = formattedError;
        if (response.status === 429) {
          modelCooldownUntil.set(model, Date.now() + 120_000);
        }
        continue;
      }
      throw new Error(formattedError);
    }

    const body = await response.json();
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .filter((part: { thought?: boolean }) => !part.thought)
      .map((part: { text?: string }) => part.text ?? "")
      .join("");
    if (!text.trim()) {
      lastError = `Gemini (${model}) returned an empty response`;
      continue;
    }
    return extractJson(text) as T;
  }

  throw new Error(lastQuotaError ?? lastError);
}

export function parseDataImage(value: string): InlineImage | null {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  return match ? { mimeType: match[1]!, data: match[2]! } : null;
}
