import React from 'react';
import { VOICES } from '../data/voices';
import { Mic, Volume2, Sparkles, Check } from 'lucide-react';

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  onPreviewSample?: (voiceId: string) => void;
  previewingVoice?: string | null;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onSelectVoice,
  onPreviewSample,
  previewingVoice,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Mic className="w-4 h-4 text-indigo-400" />
          <span>Select Voice Profile</span>
        </label>
        <span className="text-xs text-zinc-400">Gemini Neural Speech</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {VOICES.map((v) => {
          const isSelected = selectedVoice === v.id;
          const isPreviewing = previewingVoice === v.id;

          return (
            <div
              key={v.id}
              onClick={() => onSelectVoice(v.id)}
              className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-gradient-to-b from-indigo-950/70 to-zinc-900 border-indigo-500/80 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                  : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
              }`}
            >
              {/* Header inside card */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${v.color} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                  >
                    {v.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-white">{v.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          v.gender === 'Female'
                            ? 'bg-rose-500/15 text-rose-300'
                            : v.gender === 'Male'
                            ? 'bg-blue-500/15 text-blue-300'
                            : 'bg-violet-500/15 text-violet-300'
                        }`}
                      >
                        {v.gender}
                      </span>
                    </div>
                  </div>
                </div>

                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-sm">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-zinc-700 group-hover:border-zinc-500" />
                )}
              </div>

              {/* Tone info */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <p className="text-xs text-indigo-300 font-medium">{v.tone}</p>
                {v.voiceIdTag && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/20">
                    ID: {v.voiceIdTag.slice(0, 8)}...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-2">{v.description}</p>

              {/* Tags and Preview */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px]">
                <div className="flex gap-1 overflow-hidden">
                  {v.recommendedFor.slice(0, 2).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>

                {onPreviewSample && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewSample(v.id);
                    }}
                    className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium transition-colors ${
                      isPreviewing
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                    }`}
                  >
                    <Volume2 className={`w-3 h-3 ${isPreviewing ? 'animate-bounce' : ''}`} />
                    <span>{isPreviewing ? 'Testing...' : 'Sample'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
