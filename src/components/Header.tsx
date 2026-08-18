import React from 'react';
import { Sparkles, ShieldCheck, Key, RefreshCw, CheckCircle2, Radio } from 'lucide-react';

interface HeaderProps {
  hasServerKey: boolean;
  onOpenKeyModal: () => void;
  isCustomKeySet: boolean;
}

export const Header: React.FC<HeaderProps> = ({ hasServerKey, onOpenKeyModal, isCustomKeySet }) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">AI Voiceover Studio</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Unlimited Length
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Gemini TTS Engine · Intelligent Chunking · Seamless WAV Master
            </p>
          </div>
        </div>

        {/* Badges and Settings */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          {/* Ethical Voice Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Gemini Prebuilt Voices</span>
            <span className="md:hidden">Prebuilt Voices</span>
          </div>

          {/* Server API Key Status */}
          <button
            onClick={onOpenKeyModal}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              hasServerKey || isCustomKeySet
                ? 'bg-zinc-900 border-zinc-700/80 text-zinc-200 hover:border-zinc-500'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
            }`}
            title="Configure API Settings"
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {isCustomKeySet ? 'Custom Key Active' : hasServerKey ? 'Environment Key Active' : 'Configure API Key'}
            </span>
            {hasServerKey || isCustomKeySet ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-0.5" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-0.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
