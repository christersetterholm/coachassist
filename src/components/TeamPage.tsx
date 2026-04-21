import React, { useState, useEffect } from 'react';
import { Globe, RefreshCcw, Home, Settings, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TeamPageProps {
  initialUrl?: string;
  onUpdateUrl: (url: string) => void;
}

export default function TeamPage({ initialUrl = '', onUpdateUrl }: TeamPageProps) {
  const [url, setUrl] = useState(initialUrl);
  const [isEditing, setIsEditing] = useState(!initialUrl);
  const [tempUrl, setTempUrl] = useState(initialUrl);
  const [iframeKey, setIframeKey] = useState(0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let formattedUrl = tempUrl.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    setUrl(formattedUrl);
    onUpdateUrl(formattedUrl);
    setIsEditing(false);
    setIframeKey(prev => prev + 1);
  };

  const handleReset = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleGoHome = () => {
    setUrl(initialUrl);
    setTempUrl(initialUrl);
    setIframeKey(prev => prev + 1);
  };

  if (isEditing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800"
        >
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 mx-auto">
            <Globe size={32} />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 text-center tracking-tight">Ställ in lagsida</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-center font-medium">
            Ange webbadressen till lagets hemsida eller kalender.
          </p>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Webbadress</label>
              <input
                type="text"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://laget.se/..."
                className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-base font-bold outline-none focus:border-indigo-600 transition-colors"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
            >
              Spara och visa
            </button>
            {initialUrl && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-full py-4 text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-all"
              >
                Avbryt
              </button>
            )}
          </form>
          
          <p className="mt-6 text-[10px] text-zinc-400 text-center leading-relaxed">
            Obs: Vissa webbplatser tillåter inte inbäddning (iFrames). Om sidan förblir tom kan du prova att använda en annan länk eller öppna sidan direkt.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-100 dark:bg-zinc-900">
      {/* Browser-like Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={handleGoHome}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors"
            title="Hem"
          >
            <Home size={18} />
          </button>
          <button 
            onClick={handleReset}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors"
            title="Uppdatera"
          >
            <RefreshCcw size={18} />
          </button>
        </div>

        <div className="hidden sm:flex flex-1 max-w-lg mx-4">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-950 rounded-full border border-zinc-200 dark:border-zinc-800 overflow-hidden w-full">
            <Globe size={12} className="text-zinc-400 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-500 truncate select-all">{url}</span>
          </div>
        </div>

        {/* Mobile address indicator (just the icon) */}
        {!isEditing && (
          <div className="flex sm:hidden flex-1 justify-center">
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 dark:bg-zinc-950 rounded-full border border-zinc-100 dark:border-zinc-800">
              <Globe size={10} className="text-zinc-400" />
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter truncate max-w-[80px]">
                {(() => {
                  try {
                    return (new URL(url).hostname).replace('www.', '');
                  } catch (e) {
                    return 'Webbsida';
                  }
                })()}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors"
            title="Inställningar"
          >
            <Settings size={18} />
          </button>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-indigo-600 transition-colors"
            title="Öppna i ny flik"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative min-h-0">
        <iframe
          key={iframeKey}
          src={url}
          className="w-full h-full border-none bg-white"
          title="Lagsida"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
        
        {/* Help Tip Overlay (briefly shown) */}
        <AnimatePresence>
          {!initialUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-900/80 backdrop-blur-md text-white text-[10px] font-bold rounded-full pointer-events-none"
            >
              Använd hemikonen för att återgå till startsidan
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
