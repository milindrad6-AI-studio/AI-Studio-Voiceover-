import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { VoiceSelector } from './components/VoiceSelector';
import { ScriptEditor } from './components/ScriptEditor';
import { GenerationHub } from './components/GenerationHub';
import { ApiKeyModal } from './components/ApiKeyModal';
import { SCRIPT_PRESETS } from './data/voices';
import { ChunkItem, MasterAudioResult, ScriptPreset } from './types';
import { splitTextIntoChunks } from './utils/chunker';
import { mergeBase64ChunksIntoWav } from './utils/audioMerger';
import { Sparkles, Info, ShieldCheck, Cpu } from 'lucide-react';

export default function App() {
  const [hasServerKey, setHasServerKey] = useState<boolean>(true);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_custom_tts_key') || '';
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // Script and Voice state
  const [selectedVoice, setSelectedVoice] = useState(SCRIPT_PRESETS[0].voice);
  const [stylePrompt, setStylePrompt] = useState(SCRIPT_PRESETS[0].stylePrompt);
  const [scriptText, setScriptText] = useState(SCRIPT_PRESETS[0].sampleText);
  const [chunkTargetWords, setChunkTargetWords] = useState(150);

  // Generation state
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState<number | null>(null);
  const [overallStatus, setOverallStatus] = useState<string>('Ready to synthesize');
  const [masterResult, setMasterResult] = useState<MasterAudioResult | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [quotaCountdown, setQuotaCountdown] = useState<number | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);

  // Check health of backend server on load
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.hasServerKey !== undefined) {
          setHasServerKey(data.hasServerKey);
        }
      })
      .catch((err) => {
        console.warn('Backend health check error:', err);
      });
  }, []);

  // Update chunks whenever script text or chunk target changes
  useEffect(() => {
    if (!isGenerating) {
      const newChunks = splitTextIntoChunks(scriptText, 600);
      setChunks(newChunks);
    }
  }, [scriptText, isGenerating]);

  // Utility sleep
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Browser Web Speech fallback helper
  const speakWithBrowserSpeech = (text: string, voiceName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        return reject(new Error('Web Speech API not supported in this browser.'));
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const isFemale = voiceName === 'Kore' || voiceName === 'Aoede' || voiceName === 'Bella';
      const matched = voices.find((v) =>
        isFemale ? v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha')
                 : v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('daniel')
      ) || voices[0];

      if (matched) utterance.voice = matched;
      utterance.rate = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);
      window.speechSynthesis.speak(utterance);
    });
  };

  const handleSaveCustomKey = (key: string) => {
    setCustomApiKey(key);
    if (key) {
      localStorage.setItem('gemini_custom_tts_key', key);
      setQuotaWarning(null);
    } else {
      localStorage.removeItem('gemini_custom_tts_key');
    }
  };

  const handleSelectPreset = (preset: ScriptPreset) => {
    setSelectedVoice(preset.voice);
    setStylePrompt(preset.stylePrompt);
    setScriptText(preset.sampleText);
    setMasterResult(null);
    setOverallStatus('Preset loaded: ' + preset.title);
  };

  // Preview voice sample with a quick short phrase & fallback
  const handlePreviewVoice = async (voiceId: string) => {
    try {
      setPreviewingVoice(voiceId);
      const res = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Hello, I am ${voiceId}. Here is a short audio sample of my voice.`,
          voice: voiceId,
          apiKey: customApiKey,
        }),
      });

      const data = await res.json();
      if (res.status === 429 || data.isQuotaExceeded) {
        setQuotaWarning(`Gemini Free Tier Quota Limit hit for voice sample. Falling back to local browser preview.`);
        await speakWithBrowserSpeech(`Hello, I am ${voiceId}. This is a local voice preview.`, voiceId);
        return;
      }

      if (data.error) throw new Error(data.error);

      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        await audio.play();
      }
    } catch (err: any) {
      console.warn('Gemini preview error, attempting browser speech:', err);
      try {
        await speakWithBrowserSpeech(`Hello, I am ${voiceId}. Here is a voice sample.`, voiceId);
      } catch {
        alert(`Voice sample note: ${err.message}`);
      }
    } finally {
      setPreviewingVoice(null);
    }
  };

  // Synthesize a single chunk with auto-countdown on 429 quota exhaustion
  const synthesizeChunkWithRetry = async (
    chunkText: string,
    chunkIndex: number,
    totalChunks: number,
    maxRetries = 2
  ): Promise<{ base64Wav: string; audioUrl: string; duration: number }> => {
    let attempt = 0;
    while (attempt <= maxRetries) {
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunkText,
          voice: selectedVoice,
          style: stylePrompt,
          apiKey: customApiKey,
        }),
      });

      const data = await response.json();

      if (response.status === 429 || data.isQuotaExceeded) {
        const waitSec = data.retrySeconds || 45;
        setQuotaWarning(`Free tier quota limit reached. Cooldown required (${waitSec}s) or enter a custom API key.`);

        // Countdown timer in UI
        for (let s = waitSec; s > 0; s--) {
          setQuotaCountdown(s);
          setOverallStatus(`Free tier quota cooldown: retrying chunk ${chunkIndex + 1}/${totalChunks} in ${s}s...`);
          await sleep(1000);
        }
        setQuotaCountdown(null);
        attempt++;
        setOverallStatus(`Retrying chunk ${chunkIndex + 1} of ${totalChunks}...`);
        continue;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setQuotaWarning(null);
      return {
        base64Wav: data.base64Wav,
        audioUrl: data.audioUrl,
        duration: data.duration,
      };
    }
    throw new Error(`Quota limit was exceeded after retries. Please paste your Gemini API Key in Settings to proceed without limits.`);
  };

  // Main generation loop across all chunks with seamless merging
  const handleStartGeneration = async () => {
    if (!scriptText.trim()) {
      alert('Please enter or paste your script first.');
      return;
    }

    const currentChunks = splitTextIntoChunks(scriptText, 600);
    if (currentChunks.length === 0) return;

    setIsGenerating(true);
    setMasterResult(null);
    setQuotaWarning(null);
    setChunks(currentChunks.map((c) => ({ ...c, status: 'pending' })));

    const audioBase64List: string[] = [];
    const updatedChunks = [...currentChunks];

    try {
      for (let i = 0; i < currentChunks.length; i++) {
        setCurrentGeneratingIndex(i);
        setOverallStatus(`Synthesizing chunk ${i + 1} of ${currentChunks.length}...`);

        updatedChunks[i] = { ...updatedChunks[i], status: 'generating' };
        setChunks([...updatedChunks]);

        const result = await synthesizeChunkWithRetry(currentChunks[i].text, i, currentChunks.length);

        updatedChunks[i] = {
          ...updatedChunks[i],
          status: 'done',
          base64Wav: result.base64Wav,
          audioUrl: result.audioUrl,
          duration: result.duration,
        };
        audioBase64List.push(result.base64Wav);
        setChunks([...updatedChunks]);

        // Polite delay between chunks to respect RPM
        if (i < currentChunks.length - 1) {
          await sleep(800);
        }
      }

      setOverallStatus('Stitching audio chunks into seamless master WAV...');

      // Try server merge first, fallback to browser merge
      let mergedUrl = '';
      let mergedBase64 = '';
      let totalDuration = 0;
      let totalBytes = 0;

      try {
        const mergeRes = await fetch('/api/tts/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioChunks: audioBase64List }),
        });
        const mergeData = await mergeRes.json();
        if (mergeData.success) {
          mergedUrl = mergeData.audioUrl;
          mergedBase64 = mergeData.mergedBase64;
          totalDuration = mergeData.duration;
          totalBytes = mergeData.totalBytes;
        } else {
          throw new Error(mergeData.error);
        }
      } catch (mergeErr) {
        console.warn('Server merge fallback to client-side merge:', mergeErr);
        const clientMerged = mergeBase64ChunksIntoWav(audioBase64List, 24000);
        mergedUrl = clientMerged.url;
        totalDuration = clientMerged.duration;
        totalBytes = clientMerged.blob.size;
      }

      setMasterResult({
        audioUrl: mergedUrl,
        base64Wav: mergedBase64,
        duration: totalDuration,
        totalBytes: totalBytes,
        chunksCount: audioBase64List.length,
        createdAt: Date.now(),
      });

      setOverallStatus(`Complete! Generated ${currentChunks.length} chunks seamlessly merged.`);
    } catch (err: any) {
      console.error('Generation error:', err);
      setOverallStatus(`Error: ${err.message || 'Generation failed'}. Tip: Add your API key in settings.`);
    } finally {
      setIsGenerating(false);
      setCurrentGeneratingIndex(null);
      setQuotaCountdown(null);
    }
  };

  // Re-generate a single chunk if needed
  const handleRegenerateChunk = async (index: number) => {
    if (isGenerating || !chunks[index]) return;

    try {
      setCurrentGeneratingIndex(index);
      const targetChunk = chunks[index];
      const updatedChunks = [...chunks];
      updatedChunks[index] = { ...targetChunk, status: 'generating' };
      setChunks(updatedChunks);

      const result = await synthesizeChunkWithRetry(targetChunk.text, index, 1);

      updatedChunks[index] = {
        ...targetChunk,
        status: 'done',
        base64Wav: result.base64Wav,
        audioUrl: result.audioUrl,
        duration: result.duration,
      };
      setChunks(updatedChunks);

      // Re-stitch master if all chunks are done
      const allDone = updatedChunks.every((c) => c.status === 'done' && c.base64Wav);
      if (allDone) {
        const audioList = updatedChunks.map((c) => c.base64Wav!);
        const clientMerged = mergeBase64ChunksIntoWav(audioList, 24000);
        setMasterResult({
          audioUrl: clientMerged.url,
          base64Wav: '',
          duration: clientMerged.duration,
          totalBytes: clientMerged.blob.size,
          chunksCount: audioList.length,
          createdAt: Date.now(),
        });
        setOverallStatus(`Chunk ${index + 1} updated and master re-stitched.`);
      }
    } catch (err: any) {
      console.error('Chunk regen error:', err);
      const updatedChunks = [...chunks];
      updatedChunks[index] = { ...updatedChunks[index], status: 'error', error: err.message };
      setChunks(updatedChunks);
      setOverallStatus(`Chunk ${index + 1} regeneration note: ${err.message}`);
    } finally {
      setCurrentGeneratingIndex(null);
      setQuotaCountdown(null);
    }
  };

  const handleCancelGeneration = () => {
    setIsGenerating(false);
    setCurrentGeneratingIndex(null);
    setOverallStatus('Generation stopped by user.');
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        hasServerKey={hasServerKey}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        isCustomKeySet={Boolean(customApiKey)}
      />

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Banner Notice from Request */}
        <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-zinc-200">Ethical & High-Performance Synthesis:</span>{' '}
              <span>
                Uses Gemini prebuilt neural speech voices. Smart chunking ensures scripts from 500 words to 50,000+ words
                synthesize reliably with zero character cutoff.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-[11px] font-mono">
              24kHz WAV Master
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Voice Picker & Script Studio (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Voice Profiles */}
            <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-850 shadow-xl space-y-4">
              <VoiceSelector
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoice}
                onPreviewSample={handlePreviewVoice}
                previewingVoice={previewingVoice}
              />
            </div>

            {/* Script Text Editor */}
            <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-850 shadow-xl">
              <ScriptEditor
                text={scriptText}
                onChangeText={setScriptText}
                stylePrompt={stylePrompt}
                onChangeStylePrompt={setStylePrompt}
                onSelectPreset={handleSelectPreset}
                chunks={chunks}
                chunkTargetWords={chunkTargetWords}
                onChangeChunkTargetWords={setChunkTargetWords}
              />
            </div>
          </div>

          {/* Right Column: Generation Engine, Master Audio & Chunks (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <GenerationHub
              isGenerating={isGenerating}
              onStartGeneration={handleStartGeneration}
              onCancelGeneration={handleCancelGeneration}
              chunks={chunks}
              currentGeneratingIndex={currentGeneratingIndex}
              overallStatus={overallStatus}
              masterResult={masterResult}
              onRegenerateChunk={handleRegenerateChunk}
              voiceName={selectedVoice}
              quotaCountdown={quotaCountdown}
              quotaWarning={quotaWarning}
              onOpenKeyModal={() => setIsKeyModalOpen(true)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-4 text-center text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI Voiceover Studio · Gemini TTS Neural Architecture</span>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>Sample Rate: 24,000 Hz</span>
            <span>·</span>
            <span>Channels: 1 (Mono)</span>
            <span>·</span>
            <span>Bit Depth: 16-Bit PCM</span>
          </div>
        </div>
      </footer>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        hasServerKey={hasServerKey}
        customKey={customApiKey}
        onSaveCustomKey={handleSaveCustomKey}
      />
    </div>
  );
}
