import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Helper to create WAV header for 16-bit mono PCM audio
function createWavHeader(dataLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  // "RIFF" chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4); // File size - 8
  header.write("WAVE", 8);

  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40); // Subchunk2Size

  return header;
}

// Extract raw PCM bytes from either raw PCM or WAV container
function extractRawPcm(buffer: Buffer): Buffer {
  if (buffer.length >= 44 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") {
    // Find the 'data' chunk
    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      if (chunkId === "data") {
        const dataStart = offset + 8;
        return buffer.subarray(dataStart, Math.min(buffer.length, dataStart + chunkSize));
      }
      offset += 8 + chunkSize;
    }
    // Fallback: strip standard 44-byte header
    return buffer.subarray(44);
  }
  return buffer;
}

// Helper to get GoogleGenAI client
function getAIClient(customKey?: string) {
  const apiKey = customKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on server or in request.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API Health
app.get("/api/health", (_req, res) => {
  const hasServerKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
  res.json({
    status: "ok",
    hasServerKey,
  });
});

// Parse GenAI error details cleanly
function parseGenAIError(err: any): { message: string; isQuotaExceeded: boolean; retrySeconds: number } {
  const errStr = typeof err === "string" ? err : err?.message || JSON.stringify(err);
  let isQuotaExceeded = false;
  let retrySeconds = 45;
  let cleanMessage = "Audio generation failed.";

  if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || errStr.includes("rate-limits")) {
    isQuotaExceeded = true;
    cleanMessage = "Gemini API Quota Exceeded (Free Tier Rate Limit).";
    
    // Try to find retry delay like "retry in 45.48s" or "retryDelay":"45s"
    const matchSeconds = errStr.match(/retry in ([\d\.]+)s/i) || errStr.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (matchSeconds && matchSeconds[1]) {
      retrySeconds = Math.ceil(parseFloat(matchSeconds[1]));
    }
  } else if (err?.message) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.error?.message) {
        cleanMessage = parsed.error.message;
      }
    } catch {
      cleanMessage = err.message;
    }
  }

  return { message: cleanMessage, isQuotaExceeded, retrySeconds };
}

// Map friendly character voices to Gemini prebuilt voice configs with enhanced delivery styles
function resolvePrebuiltVoice(voiceName: string): { prebuiltVoice: string; styleEnhancement: string } {
  const norm = (voiceName || "").toLowerCase();
  
  if (norm.includes("bfgb7jtlunzebzrifyyq") || norm.includes("elevenlabs") || norm.includes("documentary")) {
    return {
      prebuiltVoice: "Charon", // Deep, resonant, cinematic documentary baritone
      styleEnhancement: "Narrate in the authoritative, gripping, cinematic documentary cadence of the ElevenLabs voice (bfGb7JTLUnZebZRiFYyq), with rich vocal gravitas, deliberate timing, crisp diction, and dramatic storytelling weight.",
    };
  }
  if (norm.includes("adam")) {
    return {
      prebuiltVoice: "Charon", // Deep, resonant, theatrical baritone
      styleEnhancement: "Speak in the deep, seasoned, atmospheric baritone style of Adam, a master fantasy and mystery storyteller with dramatic pauses and epic cadence.",
    };
  }
  if (norm.includes("bella") || norm.includes("brelena")) {
    return {
      prebuiltVoice: "Aoede", // Warm, enchanting, melodic female storyteller
      styleEnhancement: "Speak in the expressive, warm, enchanting storybook tone of Bella (Brelena), with rich emotional pacing, lyrical warmth, and engaging narrative inflection.",
    };
  }
  if (norm.includes("puck")) return { prebuiltVoice: "Puck", styleEnhancement: "" };
  if (norm.includes("charon")) return { prebuiltVoice: "Charon", styleEnhancement: "" };
  if (norm.includes("fenrir")) return { prebuiltVoice: "Fenrir", styleEnhancement: "" };
  if (norm.includes("aoede")) return { prebuiltVoice: "Aoede", styleEnhancement: "" };
  if (norm.includes("zephyr")) return { prebuiltVoice: "Zephyr", styleEnhancement: "" };
  return { prebuiltVoice: "Kore", styleEnhancement: "" };
}

// Synthesize single chunk
app.post("/api/tts/synthesize", async (req, res) => {
  try {
    const { text, voice = "Kore", style = "", apiKey: customKey } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required for synthesis." });
    }

    const { prebuiltVoice, styleEnhancement } = resolvePrebuiltVoice(voice);
    const ai = getAIClient(customKey);

    const fullStyle = [styleEnhancement, style?.trim()].filter(Boolean).join("\n");
    const contentText = fullStyle ? `${fullStyle}\n\n${text.trim()}` : text.trim();

    // Use official Gemini 3.1 Flash TTS model
    const ttsModel = "gemini-3.1-flash-tts-preview";
    let base64Audio: string | null = null;
    let lastError: any = null;

    try {
      const response = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ parts: [{ text: contentText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: prebuiltVoice,
              },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        base64Audio = part.inlineData.data;
      } else {
        throw new Error("No audio payload returned from Gemini TTS model.");
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`TTS attempt with model ${ttsModel} failed:`, err?.message || err);
    }

    if (!base64Audio) {
      const parsed = parseGenAIError(lastError);
      return res.status(parsed.isQuotaExceeded ? 429 : 500).json({
        error: parsed.message,
        isQuotaExceeded: parsed.isQuotaExceeded,
        retrySeconds: parsed.retrySeconds,
        details: parsed.isQuotaExceeded
          ? `The free tier quota limit was reached. You can wait ${parsed.retrySeconds}s for cooldown or paste your personal Gemini API key from https://aistudio.google.com/apikey for instant uninterrupted access.`
          : undefined,
      });
    }

    // Standardize to WAV with header
    const rawBuffer = Buffer.from(base64Audio, "base64");
    const pcm = extractRawPcm(rawBuffer);
    const wavHeader = createWavHeader(pcm.length, 24000, 1, 16);
    const wavBuffer = Buffer.concat([wavHeader, pcm]);
    const finalBase64 = wavBuffer.toString("base64");

    const sampleRate = 24000;
    const durationSeconds = pcm.length / (sampleRate * 2);

    res.json({
      success: true,
      base64Wav: finalBase64,
      audioUrl: `data:audio/wav;base64,${finalBase64}`,
      duration: durationSeconds,
      pcmByteLength: pcm.length,
    });
  } catch (error: any) {
    console.error("Synthesize error:", error);
    const parsed = parseGenAIError(error);
    res.status(parsed.isQuotaExceeded ? 429 : 500).json({
      error: parsed.message,
      isQuotaExceeded: parsed.isQuotaExceeded,
      retrySeconds: parsed.retrySeconds,
      details: parsed.isQuotaExceeded
        ? `Free tier quota limit reached. Cooldown: ${parsed.retrySeconds}s.`
        : undefined,
    });
  }
});

// Merge multiple base64 audio chunks into one seamless WAV
app.post("/api/tts/merge", (req, res) => {
  try {
    const { audioChunks } = req.body;
    if (!Array.isArray(audioChunks) || audioChunks.length === 0) {
      return res.status(400).json({ error: "audioChunks array is required." });
    }

    const pcmBuffers: Buffer[] = [];
    let totalPcmLength = 0;

    for (const chunkBase64 of audioChunks) {
      if (!chunkBase64) continue;
      // Strip potential data URL prefix
      const cleanBase64 = chunkBase64.replace(/^data:audio\/[^;]+;base64,/, "");
      const buf = Buffer.from(cleanBase64, "base64");
      const pcm = extractRawPcm(buf);
      pcmBuffers.push(pcm);
      totalPcmLength += pcm.length;
    }

    if (totalPcmLength === 0) {
      return res.status(400).json({ error: "No valid PCM audio data found in chunks." });
    }

    const allPcm = Buffer.concat(pcmBuffers, totalPcmLength);
    const wavHeader = createWavHeader(allPcm.length, 24000, 1, 16);
    const mergedWav = Buffer.concat([wavHeader, allPcm]);
    const mergedBase64 = mergedWav.toString("base64");

    const durationSeconds = allPcm.length / (24000 * 2);

    res.json({
      success: true,
      mergedBase64,
      audioUrl: `data:audio/wav;base64,${mergedBase64}`,
      duration: durationSeconds,
      totalBytes: mergedWav.length,
      chunksCount: pcmBuffers.length,
    });
  } catch (error: any) {
    console.error("Merge error:", error);
    res.status(500).json({ error: error?.message || "Failed to merge audio chunks." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Voiceover Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
