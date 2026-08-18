export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male' | 'Neutral';
  tone: string;
  description: string;
  accent: string;
  color: string;
  recommendedFor: string[];
  voiceIdTag?: string;
  source?: string;
}

export interface ChunkItem {
  id: string;
  index: number;
  text: string;
  status: 'idle' | 'pending' | 'generating' | 'done' | 'error';
  audioUrl?: string;
  base64Wav?: string;
  duration?: number;
  error?: string;
  byteLength?: number;
}

export interface ScriptPreset {
  id: string;
  title: string;
  category: 'YouTube' | 'Audiobook' | 'Commercial' | 'Documentary' | 'Meditation';
  voice: string;
  stylePrompt: string;
  description: string;
  sampleText: string;
}

export interface GenerationSettings {
  voice: string;
  stylePrompt: string;
  chunkTargetWords: number; // e.g. 100, 180, 250
  autoMerge: boolean;
}

export interface MasterAudioResult {
  audioUrl: string;
  base64Wav: string;
  duration: number;
  totalBytes: number;
  chunksCount: number;
  createdAt: number;
}
