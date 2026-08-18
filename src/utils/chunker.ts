import { ChunkItem } from '../types';

/**
 * Splits arbitrary length script into natural sentence chunks
 * targetMaxChars default is ~600 chars (~100-120 words) for smooth Gemini TTS synthesis
 */
export function splitTextIntoChunks(text: string, targetMaxChars = 600): ChunkItem[] {
  if (!text || !text.trim()) return [];

  // Normalize line endings
  const clean = text.replace(/\r\n/g, '\n').trim();
  
  // First, break into paragraphs or major sentence blocks
  const rawSentences: string[] = [];
  const paragraphs = clean.split(/\n\s*\n/);

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    
    // Match full sentences ending with . ! ? or trailing text
    const matched = para.match(/[^.!?\n]+[.!?]+(\s+|$)|[^.!?\n]+$/g);
    if (matched && matched.length > 0) {
      for (const s of matched) {
        const trimmed = s.trim();
        if (trimmed) rawSentences.push(trimmed);
      }
    } else {
      rawSentences.push(para.trim());
    }
  }

  // Combine small sentences into target chunks without exceeding targetMaxChars
  const chunkTexts: string[] = [];
  let currentAccumulator = '';

  for (const sentence of rawSentences) {
    if (!currentAccumulator) {
      if (sentence.length > targetMaxChars) {
        // Break huge sentence by clauses or commas
        const subParts = breakLongSentence(sentence, targetMaxChars);
        chunkTexts.push(...subParts);
      } else {
        currentAccumulator = sentence;
      }
    } else {
      if ((currentAccumulator + ' ' + sentence).length <= targetMaxChars) {
        currentAccumulator += ' ' + sentence;
      } else {
        chunkTexts.push(currentAccumulator);
        if (sentence.length > targetMaxChars) {
          const subParts = breakLongSentence(sentence, targetMaxChars);
          chunkTexts.push(...subParts);
          currentAccumulator = '';
        } else {
          currentAccumulator = sentence;
        }
      }
    }
  }

  if (currentAccumulator.trim()) {
    chunkTexts.push(currentAccumulator.trim());
  }

  return chunkTexts.map((txt, idx) => ({
    id: `chunk-${idx}-${Date.now().toString(36)}`,
    index: idx,
    text: txt,
    status: 'idle',
  }));
}

function breakLongSentence(sentence: string, maxLen: number): string[] {
  const parts: string[] = [];
  const words = sentence.split(/\s+/);
  let current = '';

  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + ' ' + w).length <= maxLen) {
      current += ' ' + w;
    } else {
      parts.push(current);
      current = w;
    }
  }

  if (current) parts.push(current);
  return parts;
}

export function estimateAudioDuration(text: string): { words: number; chars: number; seconds: number; formatted: string } {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  // Average speaking pace ~145 words per minute (2.4 words per second)
  const seconds = Math.max(1, Math.round(words / 2.4));
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  const formatted = mins > 0 ? `${mins}m ${remSecs}s` : `${seconds}s`;

  return { words, chars, seconds, formatted };
}
