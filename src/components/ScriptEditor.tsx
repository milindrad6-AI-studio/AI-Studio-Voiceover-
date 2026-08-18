import React, { useState, useRef } from 'react';
import { SCRIPT_PRESETS, STYLE_MODIFIERS } from '../data/voices';
import { ScriptPreset, ChunkItem } from '../types';
import { estimateAudioDuration } from '../utils/chunker';
import {
  FileText,
  Upload,
  Sparkles,
  Layers,
  Trash2,
  Copy,
  Check,
  Wand2,
  Clock,
  Type,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ScriptEditorProps {
  text: string;
  onChangeText: (text: string) => void;
  stylePrompt: string;
  onChangeStylePrompt: (style: string) => void;
  onSelectPreset: (preset: ScriptPreset) => void;
  chunks: ChunkItem[];
  chunkTargetWords: number;
  onChangeChunkTargetWords: (target: number) => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  text,
  onChangeText,
  stylePrompt,
  onChangeStylePrompt,
  onSelectPreset,
  chunks,
  chunkTargetWords,
  onChangeChunkTargetWords,
}) => {
  const [showChunkPreview, setShowChunkPreview] = useState(false);
  const [showStyleHelper, setShowStyleHelper] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = estimateAudioDuration(text);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onChangeText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Presets & Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Script Studio</span>
          </label>
        </div>

        {/* Presets dropdown / Quick Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-zinc-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Presets:
          </span>
          {SCRIPT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPreset(p)}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-850 transition-colors"
              title={p.description}
            >
              {p.title.split(' ')[0]} {p.title.split(' ')[1] || ''}
            </button>
          ))}
        </div>
      </div>

      {/* Main Textarea Container */}
      <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/60 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/40 transition-all">
        <textarea
          id="script-input-textarea"
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Paste or type your script here. Unlimited length supported — the engine will automatically partition long text into natural sentence chunks and synthesize seamlessly without error..."
          className="w-full h-64 sm:h-72 p-4 bg-transparent text-zinc-100 placeholder-zinc-500 text-sm leading-relaxed outline-none resize-y font-normal font-sans"
        />

        {/* Text Area Bottom Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-zinc-950/60 border-t border-zinc-800/80 rounded-b-xl text-xs text-zinc-400">
          {/* Stats */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium text-zinc-300">
              <Type className="w-3.5 h-3.5 text-zinc-400" />
              {stats.words.toLocaleString()} words
            </span>
            <span className="text-zinc-500">·</span>
            <span>{stats.chars.toLocaleString()} characters</span>
            <span className="text-zinc-500">·</span>
            <span className="flex items-center gap-1 text-indigo-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Est. {stats.formatted}
            </span>
            <span className="text-zinc-500">·</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              {chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.md,.rtf"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title="Upload text or script file"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!text}
              className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors disabled:opacity-40"
              title="Copy script"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onChangeText('')}
              disabled={!text}
              className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-40"
              title="Clear text"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Style & Director Instruction Prompt */}
      <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-zinc-200">Director Voice Style & Tone Prompt</span>
            <span className="text-[11px] text-zinc-500">(Optional)</span>
          </div>
          <button
            type="button"
            onClick={() => setShowStyleHelper(!showStyleHelper)}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
          >
            <span>Tone presets</span>
            {showStyleHelper ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Quick Modifiers */}
        {showStyleHelper && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 pb-2 border-b border-zinc-800/60">
            {STYLE_MODIFIERS.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => onChangeStylePrompt(m.prompt)}
                className="text-left text-[11px] p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
              >
                <div className="font-semibold text-indigo-300">{m.label}</div>
                <div className="text-[10px] text-zinc-400 line-clamp-1">{m.prompt}</div>
              </button>
            ))}
          </div>
        )}

        <input
          id="style-prompt-input"
          type="text"
          value={stylePrompt}
          onChange={(e) => onChangeStylePrompt(e.target.value)}
          placeholder="e.g. Speak in a warm, relaxed conversational cadence with thoughtful natural pauses..."
          className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Chunking Settings & Live Inspection Toggle */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowChunkPreview(!showChunkPreview)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-zinc-800/30 transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-xs">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-zinc-200">Intelligent Sentence Chunking Inspector</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 text-[10px] font-medium">
              {chunks.length} partition{chunks.length === 1 ? '' : 's'} calculated
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{showChunkPreview ? 'Hide Details' : 'View Chunk Breakdown'}</span>
            {showChunkPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showChunkPreview && (
          <div className="p-3.5 border-t border-zinc-800/60 space-y-3 bg-zinc-950/40">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Gemini TTS produces optimal acoustic naturalness on focused blocks. Our engine automatically detects sentence
              terminations (<code className="text-zinc-300">. ! ? \n</code>) to prevent mid-clause clipping.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {chunks.map((c, i) => (
                <div
                  key={c.id || i}
                  className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-700/50 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-zinc-200 leading-relaxed">{c.text}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-400">
                      <span>{c.text.split(/\s+/).length} words</span>
                      <span>·</span>
                      <span>{c.text.length} chars</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
