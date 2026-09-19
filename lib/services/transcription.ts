import { getTranscriptionProvider } from "@/lib/zernio/config";

/**
 * Transcripción de audio para el seguimiento de competidores.
 *
 * `mock` (por defecto) devuelve una transcripción plausible y determinista a
 * partir del hook, para que la demo funcione sin claves ni coste. `openai`
 * usa Whisper y `deepgram` usa su API de pre-recorded audio.
 */

export interface TranscriptionResult {
  transcript: string;
  provider: string;
  language: string;
  durationSeconds?: number;
}

export interface TranscriptionRequest {
  /** URL pública del audio/video a transcribir. */
  mediaUrl: string;
  /** Idioma esperado (ISO 639-1). */
  language?: string;
  /** Texto conocido del hook, usado por el proveedor mock. */
  hookHint?: string;
}

async function transcribeWithOpenAI(
  request: TranscriptionRequest,
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY para transcribir.");

  const audio = await fetch(request.mediaUrl);
  if (!audio.ok) {
    throw new Error(`No se pudo descargar el audio (${audio.status}).`);
  }
  const blob = await audio.blob();

  const form = new FormData();
  form.append("file", blob, "audio.mp4");
  form.append("model", "whisper-1");
  form.append("language", request.language ?? "es");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error(`OpenAI Whisper respondió ${response.status}.`);
  }

  const payload = (await response.json()) as { text?: string };
  return {
    transcript: payload.text?.trim() ?? "",
    provider: "openai",
    language: request.language ?? "es",
  };
}

async function transcribeWithDeepgram(
  request: TranscriptionRequest,
): Promise<TranscriptionResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("Falta DEEPGRAM_API_KEY para transcribir.");

  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&language=es&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: request.mediaUrl }),
    },
  );

  if (!response.ok) {
    throw new Error(`Deepgram respondió ${response.status}.`);
  }

  const payload = (await response.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
  };

  return {
    transcript:
      payload.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "",
    provider: "deepgram",
    language: request.language ?? "es",
  };
}

function mockTranscription(request: TranscriptionRequest): TranscriptionResult {
  const hook = request.hookHint ?? "Esto cambió por completo mi forma de trabajar";

  const transcript = [
    hook + ".",
    "Y no lo digo por moda: lo medí durante tres semanas seguidas.",
    "La primera semana hice todo como siempre y anoté los tiempos. La segunda cambié sólo el primer paso del proceso. La tercera repetí el cambio y comparé.",
    "El resultado fue el mismo las dos veces: la mitad del tiempo, con más alcance.",
    "Así que si estás haciendo esto a mano, estás regalando horas que no vuelven.",
    "Te dejo el detalle completo abajo.",
  ].join(" ");

  return {
    transcript,
    provider: "mock",
    language: request.language ?? "es",
    durationSeconds: 34,
  };
}

export async function transcribe(
  request: TranscriptionRequest,
): Promise<TranscriptionResult> {
  const provider = getTranscriptionProvider();

  try {
    if (provider === "openai") return await transcribeWithOpenAI(request);
    if (provider === "deepgram") return await transcribeWithDeepgram(request);
  } catch (error) {
    console.warn(
      `[transcription] El proveedor "${provider}" falló; se usa el mock.`,
      error,
    );
  }

  return mockTranscription(request);
}

/**
 * Extrae el hook de una transcripción: la primera frase con carga semántica,
 * descartando muletillas de apertura.
 */
export function extractHook(transcript: string): string {
  const FILLERS =
    /^(hola|qué tal|buenas|hey|bienvenidos|hoy (os|te) (voy a |vengo a )?|en este (video|reel)|vamos a ver)/i;

  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (!FILLERS.test(sentence) && sentence.length > 20) {
      return sentence.replace(/[.!?]+$/, "");
    }
  }

  return sentences[0]?.replace(/[.!?]+$/, "") ?? transcript.slice(0, 120);
}

/**
 * Extrae las frases que probablemente aparecen como texto en pantalla: las
 * cortas y en mayúsculas del texto de overlay que entrega la plataforma.
 */
export function extractOnScreenText(overlayText?: string): string {
  if (!overlayText) return "";
  return overlayText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 80)
    .slice(0, 3)
    .join(" · ");
}
