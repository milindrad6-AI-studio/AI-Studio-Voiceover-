/**
 * Browser-side audio utility to extract raw PCM from base64 WAVs and stitch them into a single valid WAV Blob.
 */

export function createWavBlobFromPcm(pcmBytes: Uint8Array, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Blob {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // "RIFF" chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, pcmBytes.length, true);

  // Copy PCM samples
  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmBytes, 44);

  return new Blob([wavBytes], { type: 'audio/wav' });
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function extractPcmFromWavOrRaw(bytes: Uint8Array): Uint8Array {
  // Check if starts with "RIFF"
  if (bytes.length >= 44 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // Standard WAV: check for "data" tag
    for (let i = 12; i < bytes.length - 8; i++) {
      if (bytes[i] === 0x64 && bytes[i + 1] === 0x61 && bytes[i + 2] === 0x74 && bytes[i + 3] === 0x61) {
        const dataLength = bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24);
        const start = i + 8;
        return bytes.subarray(start, Math.min(bytes.length, start + dataLength));
      }
    }
    // Fallback: standard 44-byte header
    return bytes.subarray(44);
  }
  return bytes;
}

export function mergeBase64ChunksIntoWav(chunksBase64: string[], sampleRate = 24000): { blob: Blob; url: string; duration: number } {
  const pcmList: Uint8Array[] = [];
  let totalLength = 0;

  for (const b64 of chunksBase64) {
    if (!b64) continue;
    const raw = base64ToUint8Array(b64);
    const pcm = extractPcmFromWavOrRaw(raw);
    pcmList.push(pcm);
    totalLength += pcm.length;
  }

  const mergedPcm = new Uint8Array(totalLength);
  let offset = 0;
  for (const pcm of pcmList) {
    mergedPcm.set(pcm, offset);
    offset += pcm.length;
  }

  const blob = createWavBlobFromPcm(mergedPcm, sampleRate);
  const url = URL.createObjectURL(blob);
  const duration = totalLength / (sampleRate * 2);

  return { blob, url, duration };
}

export function downloadBlob(blob: Blob, filename = 'voiceover.wav') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
