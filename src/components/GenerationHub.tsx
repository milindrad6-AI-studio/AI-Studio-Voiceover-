import React, { useRef, useState, useEffect } from 'react';
import { ChunkItem, MasterAudioResult } from '../types';
import {
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  FastForward,
  Layers,
  Music2,
  Share2,
  Check,
  Clock,
  KeyRound,
} from 'lucide-react';
import { downloadBlob } from '../utils/audioMerger';

interface GenerationHubProps {
  isGenerating: boolean;
  onStartGeneration: () => void;
  onCancelGeneration: () => void;
  chunks: ChunkItem[];
  currentGeneratingIndex: number | null;
  overallStatus: string;
  masterResult: MasterAudioResult | null;
  onRegenerateChunk: (index: number) => void;
  voiceName: string;
  quotaCountdown?: number | null;
  quotaWarning?: string | null;
  onOpenKeyModal?: () => void;
}

export const GenerationHub: React.FC<GenerationHubProps> = ({
  isGenerating,
  onStartGeneration,
  onCancelGeneration,
  chunks,
  currentGeneratingIndex,
  overallStatus,
  masterResult,
  onRegenerateChunk,
  voiceName,
  quotaCountdown,
  quotaWarning,
  onOpenKeyModal,
}) => {
  const [isPlayingMaster, setIsPlayingMaster] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [playingChunkId, setPlayingChunkId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const chunkAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync duration and reset state when master result changes
  useEffect(() => {
    if (masterResult) {
      setDuration(masterResult.duration);
      setCurrentTime(0);
      setIsPlayingMaster(false);
    }
  }, [masterResult]);

  const togglePlayMaster = () => {
    if (!masterAudioRef.current) return;
    if (isPlayingMaster) {
      masterAudioRef.current.pause();
      setIsPlayingMaster(false);
    } else {
      // Pause any chunk audio
      if (chunkAudioRef.current) {
        chunkAudioRef.current.pause();
        setPlayingChunkId(null);
      }
      masterAudioRef.current.play();
      setIsPlayingMaster(true);
    }
  };

  const handleTimeUpdate = () => {
    if (masterAudioRef.current) {
      setCurrentTime(masterAudioRef.current.currentTime);
      if (masterAudioRef.current.duration && !isNaN(masterAudioRef.current.duration)) {
        setDuration(masterAudioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (masterAudioRef.current) {
      masterAudioRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (masterAudioRef.current) {
      masterAudioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (masterAudioRef.current) {
      masterAudioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const playSingleChunk = (chunk: ChunkItem) => {
    if (!chunk.audioUrl) return;

    // Pause master
    if (masterAudioRef.current) {
      masterAudioRef.current.pause();
      setIsPlayingMaster(false);
    }

    if (playingChunkId === chunk.id && chunkAudioRef.current) {
      chunkAudioRef.current.pause();
      setPlayingChunkId(null);
      return;
    }

    if (chunkAudioRef.current) {
      chunkAudioRef.current.src = chunk.audioUrl;
      chunkAudioRef.current.playbackRate = playbackRate;
      chunkAudioRef.current.play();
      setPlayingChunkId(chunk.id);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const completedChunksCount = chunks.filter((c) => c.status === 'done').length;
  const progressPercent = chunks.length > 0 ? Math.round((completedChunksCount / chunks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Hidden audio elements */}
      {masterResult?.audioUrl && (
        <audio
          ref={masterAudioRef}
          src={masterResult.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlayingMaster(false)}
          onPause={() => setIsPlayingMaster(false)}
          onPlay={() => setIsPlayingMaster(true)}
        />
      )}
      <audio
        ref={chunkAudioRef}
        onEnded={() => setPlayingChunkId(null)}
        onPause={() => setPlayingChunkId(null)}
      />

      {/* Main Action Bar */}
      <div className="p-4 rounded-xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Music2 className="w-5 h-5 text-indigo-400" />
              <span>Voiceover Master Engine</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Active Voice: <span className="text-indigo-300 font-semibold">{voiceName}</span> · {chunks.length} total chunk
              {chunks.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isGenerating ? (
              <button
                type="button"
                onClick={onCancelGeneration}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-950/70 border border-red-800 text-red-300 hover:bg-red-900/60 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Stop Generation</span>
              </button>
            ) : (
              <button
                type="button"
                id="generate-voiceover-button"
                onClick={onStartGeneration}
                disabled={chunks.length === 0}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 animate-spin-slow" />
                <span>GENERATE VOICEOVER NOW</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress & Live Status Tracker */}
        {(isGenerating || overallStatus) && (
          <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {quotaCountdown !== null && quotaCountdown > 0 ? (
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                ) : isGenerating ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span className="font-medium text-zinc-200">{overallStatus}</span>
              </div>
              <span className="text-zinc-400 font-mono">
                {completedChunksCount}/{chunks.length} ({progressPercent}%)
              </span>
            </div>

            {/* Quota Cooldown Timer Banner */}
            {quotaCountdown !== null && quotaCountdown > 0 && (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-xs">
                    {quotaCountdown}s
                  </span>
                  <span>Free tier quota reset cooling down... auto-resuming chunk.</span>
                </div>
                {onOpenKeyModal && (
                  <button
                    type="button"
                    onClick={onOpenKeyModal}
                    className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Paste API Key to Skip</span>
                  </button>
                )}
              </div>
            )}

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Master Player UI */}
        {masterResult && (
          <div className="mt-4 p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                  MASTER READY
                </span>
                <span className="text-xs text-zinc-400">
                  {masterResult.chunksCount} chunks seamless WAV · {formatTime(duration)} duration
                </span>
              </div>

              {/* Master Download Action */}
              <a
                href={masterResult.audioUrl}
                download={`voiceover_${voiceName.toLowerCase()}_master.wav`}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Master WAV</span>
              </a>
            </div>

            {/* Playback Controls & Waveform Scrubber */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {/* Play / Pause */}
                <button
                  type="button"
                  onClick={togglePlayMaster}
                  className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 transition-transform active:scale-90 shrink-0"
                  title={isPlayingMaster ? 'Pause' : 'Play'}
                >
                  {isPlayingMaster ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                </button>

                {/* Scrubber */}
                <div className="flex-1 space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 rounded-lg bg-zinc-800 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Volume Mute */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Speed Presets */}
              <div className="flex items-center justify-between pt-2 border-t border-indigo-950/60 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 text-[11px]">Speed:</span>
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleSpeedChange(rate)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                        playbackRate === rate
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-zinc-400">Studio 24kHz 16-Bit Mono</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Individual Chunk Audio Inspection & Regenerate */}
      {chunks.length > 0 && (
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Synthesized Chunks ({chunks.length})</span>
            </h4>
            <span className="text-[11px] text-zinc-400">Inspect or re-record individual parts</span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {chunks.map((chunk, idx) => {
              const isCurrent = currentGeneratingIndex === idx;
              const isChunkPlaying = playingChunkId === chunk.id;

              return (
                <div
                  key={chunk.id || idx}
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500/80 shadow-sm'
                      : chunk.status === 'done'
                      ? 'bg-zinc-950/60 border-zinc-800/80'
                      : chunk.status === 'error'
                      ? 'bg-red-950/30 border-red-900/50'
                      : 'bg-zinc-950/30 border-zinc-800/40 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    {/* Index & Text */}
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          chunk.status === 'done'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : isCurrent
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : chunk.status === 'error'
                            ? 'bg-red-900 text-red-200'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-200 leading-relaxed line-clamp-2">{chunk.text}</p>
                        {chunk.error && <p className="text-red-400 text-[11px] mt-1">{chunk.error}</p>}
                      </div>
                    </div>

                    {/* Actions for this chunk */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {chunk.status === 'generating' || isCurrent ? (
                        <span className="px-2 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-medium animate-pulse">
                          Generating...
                        </span>
                      ) : chunk.status === 'done' && chunk.audioUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => playSingleChunk(chunk)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isChunkPlaying
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                            }`}
                            title={isChunkPlaying ? 'Pause chunk' : 'Play chunk preview'}
                          >
                            {isChunkPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5" />}
                          </button>

                          <a
                            href={chunk.audioUrl}
                            download={`chunk_${idx + 1}_${voiceName.toLowerCase()}.wav`}
                            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Download chunk WAV"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => onRegenerateChunk(idx)}
                            disabled={isGenerating}
                            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
                            title="Regenerate this specific chunk"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : chunk.status === 'error' ? (
                        <button
                          type="button"
                          onClick={() => onRegenerateChunk(idx)}
                          disabled={isGenerating}
                          className="px-2 py-1 rounded bg-red-900/60 border border-red-700 text-red-200 hover:bg-red-800 text-[10px] font-medium flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-mono">Pending</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
