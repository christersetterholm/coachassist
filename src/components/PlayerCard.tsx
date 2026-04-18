import React, { useState, useRef, useLayoutEffect } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Team, SquadPlayer } from '../types';

interface PlayerCardProps {
  team: Team;
  squad: SquadPlayer[];
  rank: number;
  onUpdateScore: (id: string, delta: number) => void;
  onRankClick?: () => void;
  disabled?: boolean;
}

export default function PlayerCard({ team, squad, rank, onUpdateScore, onRankClick, disabled }: PlayerCardProps) {
  const [fontSize, setFontSize] = useState<number>(120);
  const containerRef = useRef<HTMLDivElement>(null);

  const teamPlayers = squad.filter(p => team.playerIds.includes(p.id));

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const calculateFontSize = () => {
      if (!containerRef.current) return;
      const { height, width } = containerRef.current.getBoundingClientRect();
      const scoreStr = team.score.toString();
      const scoreLength = scoreStr.length;
      
      let size = height * 0.85;
      const charWidthRatio = 0.7;
      const maxWidthSize = (width * 0.9) / (scoreLength * charWidthRatio);
      
      setFontSize(Math.min(size, maxWidthSize));
    };

    const observer = new ResizeObserver(() => {
      calculateFontSize();
    });

    observer.observe(containerRef.current);
    calculateFontSize();

    return () => observer.disconnect();
  }, [team.score]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative rounded-2xl shadow-lg flex items-stretch transition-all duration-300 border border-black/5 flex-1 min-h-0 overflow-hidden ${disabled ? 'opacity-90' : ''}`}
      style={{ backgroundColor: team.color }}
    >
      {/* Minus Button */}
      {!disabled && (
        <button
          onClick={() => onUpdateScore(team.id, -1)}
          className="w-16 sm:w-24 bg-black/10 text-white flex items-center justify-center hover:bg-black/20 active:bg-black/30 transition-all border-r border-white/10 shrink-0"
        >
          <Minus size={24} strokeWidth={4} className="sm:size-[32px]" />
        </button>
      )}

      {/* Central Column */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-1 sm:p-2 border-b border-white/10 flex flex-col items-center justify-center shrink-0">
          <div className="flex flex-wrap justify-center gap-1 px-2">
            {teamPlayers.length > 0 ? (
              teamPlayers.map(p => (
                <span key={p.id} className="text-[8px] sm:text-[10px] font-bold text-white/80 bg-white/10 px-1.5 py-0.5 rounded-full">
                  {p.name}
                </span>
              ))
            ) : (
              <span className="text-[8px] sm:text-[10px] font-bold text-white/40 italic">Inga spelare</span>
            )}
          </div>
        </div>

        {/* Score Display */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-0.5 overflow-hidden relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRankClick?.();
            }}
            className="absolute top-1 left-1 sm:top-2 sm:left-2 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full border border-white/30 shadow-inner z-10 transition-colors cursor-pointer"
          >
            <span className="text-sm sm:text-lg font-black text-white">{rank}</span>
          </button>
          
          <span 
            className="font-black text-white tabular-nums drop-shadow-md leading-none select-none transition-all duration-300"
            style={{ fontSize: `${fontSize}px` }}
          >
            {team.score}
          </span>
        </div>
      </div>

      {/* Plus Buttons */}
      {!disabled && (
        <div className="flex shrink-0">
          <div className="w-12 sm:w-16 flex flex-col border-l border-white/10">
            <button
              onClick={() => onUpdateScore(team.id, 2)}
              className="flex-1 bg-white/5 text-white text-sm sm:text-xl font-black hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center"
            >
              +2
            </button>
            <button
              onClick={() => onUpdateScore(team.id, 3)}
              className="flex-1 bg-white/5 text-white text-sm sm:text-xl font-black hover:bg-white/15 active:bg-white/25 transition-all border-t border-white/10 flex items-center justify-center"
            >
              +3
            </button>
          </div>

          <button
            onClick={() => onUpdateScore(team.id, 1)}
            className="w-20 sm:w-28 bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-all border-l border-white/10"
          >
            <Plus size={32} strokeWidth={4} className="sm:size-[48px]" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
