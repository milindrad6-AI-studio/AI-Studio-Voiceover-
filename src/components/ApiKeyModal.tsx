import React, { useState } from 'react';
import { X, Key, ShieldCheck, ExternalLink, Check, Trash2 } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasServerKey: boolean;
  customKey: string;
  onSaveCustomKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  hasServerKey,
  customKey,
  onSaveCustomKey,
}) => {
  const [inputValue, setInputValue] = useState(customKey);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveCustomKey(inputValue.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const handleClear = () => {
    setInputValue('');
    onSaveCustomKey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">API Key Configuration</h3>
              <p className="text-xs text-zinc-400">Gemini Neural Speech & Voiceover Engine</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Server status banner */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium">Server Environment Status:</span>
            {hasServerKey ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Active in Cloud Run
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-semibold">
                Server Key Not Found
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            When running in Google AI Studio, the app securely uses the connected environment secret. You can also specify
            a personal Gemini API key below.
          </p>
        </div>

        {/* Custom Key Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
            <span>Custom Gemini API Key Override</span>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </label>
          <input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-mono"
          />
        </div>

        {/* Ethical disclaimer from request */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed space-y-1">
          <p className="font-semibold text-zinc-300">Ethical Audio Cloning Notice:</p>
          <p>
            This studio utilizes official Gemini prebuilt neural speech voices (Kore, Puck, Charon, Aoede, Fenrir, Zephyr).
            Unlimited length is achieved ethically via natural sentence chunking and sample-accurate WAV stitching.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          {customKey ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Custom Key</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-colors flex items-center gap-1.5"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
