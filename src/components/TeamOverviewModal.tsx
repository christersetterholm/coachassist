import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, LayoutList, Play, X } from 'lucide-react';
import { Exercise, SquadPlayer } from '../types';
import { sortPlayersByPosition } from '../lib/teamUtils';

interface TeamOverviewModalProps {
  exercise: Exercise;
  squad: SquadPlayer[];
  attendingIds?: string[];
  onMovePlayer: (exerciseId: string, playerId: string, targetTeamId: string) => void;
  onClose: () => void;
  onStart?: () => void;
}

export default function TeamOverviewModal({
  exercise,
  squad,
  attendingIds,
  onMovePlayer,
  onClose,
  onStart
}: TeamOverviewModalProps) {
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  // Identify players who are attending but not in any team or joker pool
  const assignedPlayerIds = new Set([
    ...(exercise.teams?.flatMap(t => t.playerIds || []) || []),
    ...(exercise.jokerPlayerIds || [])
  ]);

  // Unassigned players are those who are in the attending list but not in assignedPlayerIds
  // If attendingIds is not provided (standalone exercise), we might not have "unassigned" concept the same way
  // but if we do, it's players from squad not in teams.
  const unassignedPlayers = attendingIds 
    ? squad.filter(p => attendingIds.includes(p.id) && !assignedPlayerIds.has(p.id))
    : [];

  const isUnassignedDragging = draggedPlayerId && unassignedPlayers.some(p => p.id === draggedPlayerId);

  const handleDragUpdate = (x: number, y: number) => {
    const targetId = detectTarget(x, y);
    if (targetId !== activeTargetId) {
      setActiveTargetId(targetId);
    }
  };

  const detectTarget = (x: number, y: number) => {
    // 1. Try elementFromPoint (Fastest)
    const element = document.elementFromPoint(x, y);
    const target = element?.closest('[data-team-id]');
    if (target) return target.getAttribute('data-team-id');
    
    // 2. Manual fall-back (More robust for edge cases)
    const allContainers = document.querySelectorAll('[data-team-id]');
    for (const container of Array.from(allContainers)) {
      const rect = container.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return container.getAttribute('data-team-id');
      }
    }
    return null;
  };

  const handleDragEnd = (playerId: string) => {
    if (activeTargetId) {
      // Find source team ID to see if we're dropping back into the same team
      const sourceTeam = exercise.teams.find(t => t.playerIds?.includes(playerId));
      const isJokerSource = exercise.jokerPlayerIds?.includes(playerId);
      const sourceId = sourceTeam ? sourceTeam.id : (isJokerSource ? 'joker' : 'none');

      if (activeTargetId !== sourceId) {
        onMovePlayer(exercise.id, playerId, activeTargetId);
      }
    }
    setDraggedPlayerId(null);
    setActiveTargetId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <LayoutList size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Lagöversikt</h3>
              <p className="text-sm text-zinc-500 font-medium">
                {exercise.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-xl transition-colors"
          >
            <Plus size={24} className="rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exercise.teams.filter(t => (t.playerIds?.length || 0) > 0 || !exercise.isFinished).map((team, idx) => {
              const isThisTeamDragging = draggedPlayerId && team.playerIds?.includes(draggedPlayerId);
              return (
                <div 
                  key={team.id} 
                  data-team-id={team.id}
                  className={`bg-zinc-50 dark:bg-zinc-950 p-6 rounded-3xl border transition-all duration-200 flex flex-col h-full ${activeTargetId === team.id ? 'scale-[1.02] border-indigo-500 bg-indigo-50/50 shadow-lg' : (draggedPlayerId ? 'border-zinc-200 dark:border-zinc-800 opacity-60' : 'border-zinc-100 dark:border-zinc-800')}`}
                  style={{ zIndex: isThisTeamDragging ? 100 : (activeTargetId === team.id ? 80 : (draggedPlayerId ? 10 : 1)), position: 'relative' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: team.color }} />
                    <span className="font-black text-sm text-zinc-900 dark:text-white uppercase tracking-tight flex-1">Lag {idx + 1}</span>
                    <div className="flex items-center gap-1.5 bg-zinc-200/50 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                      <Users size={12} className="text-zinc-500" />
                      <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                        {team.playerIds?.length || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {sortPlayersByPosition(team.playerIds || [], squad).map(pid => {
                      const player = squad.find(p => p.id === pid);
                      return player ? (
                        <motion.div 
                          key={pid} 
                          drag
                          dragSnapToOrigin
                          whileDrag={{ 
                            zIndex: 9999, 
                            scale: 1.1,
                            pointerEvents: 'none'
                          }}
                          onDragStart={() => setDraggedPlayerId(pid)}
                          onDrag={(e: any, info) => {
                            const point = (e.nativeEvent || e).clientX !== undefined ? (e.nativeEvent || e) : info.point;
                            handleDragUpdate(point.clientX || point.x, point.clientY || point.y);
                          }}
                          onDragEnd={() => {
                            handleDragEnd(pid);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1 cursor-grab active:cursor-grabbing touch-none z-50`} 
                          style={{ backgroundColor: team.color }}
                        >
                          <div className="flex items-center gap-1">
                            <span>{player.name}</span>
                            {player.position && <span className="opacity-70 text-[8px]">({player.position})</span>}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMovePlayer(exercise.id, pid, 'none');
                              }}
                              className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                              title="Ta bort från lag"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </motion.div>
                      ) : null;
                    })}
                    {team.playerIds?.length === 0 && (
                      <div className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        Släpp spelare här
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {(exercise.jokerPlayerIds?.length || 0) > 0 && (() => {
              const isJokerDragging = draggedPlayerId && exercise.jokerPlayerIds?.includes(draggedPlayerId);
              return (
                <div 
                  key="joker-overview"
                  data-team-id="joker"
                  className={`bg-indigo-50 dark:bg-indigo-950/30 p-6 rounded-3xl border transition-all duration-200 flex flex-col h-full shadow-sm ${activeTargetId === 'joker' ? 'scale-[1.02] border-indigo-600 bg-indigo-100/50 shadow-lg' : (draggedPlayerId ? 'border-indigo-200 opacity-60' : 'border-indigo-100 dark:border-indigo-900/40')}`}
                  style={{ zIndex: isJokerDragging ? 100 : (activeTargetId === 'joker' ? 80 : (draggedPlayerId ? 10 : 1)), position: 'relative' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-4 h-4 rounded-full bg-indigo-600 shadow-sm" />
                    <span className="font-black text-sm text-indigo-900 dark:text-indigo-100 uppercase tracking-tight flex-1">Jokrar</span>
                    <div className="flex items-center gap-1.5 bg-indigo-200/50 dark:bg-indigo-900/50 px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <Users size={12} />
                      <span className="text-xs font-black">
                        {exercise.jokerPlayerIds?.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {sortPlayersByPosition(exercise.jokerPlayerIds || [], squad).map(pid => {
                      const player = squad.find(p => p.id === pid);
                      return player ? (
                        <motion.div 
                          key={pid} 
                          drag
                          dragSnapToOrigin
                          whileDrag={{ 
                            zIndex: 9999, 
                            scale: 1.1,
                            pointerEvents: 'none'
                          }}
                          onDragStart={() => setDraggedPlayerId(pid)}
                          onDrag={(e: any, info) => {
                            const point = (e.nativeEvent || e).clientX !== undefined ? (e.nativeEvent || e) : info.point;
                            handleDragUpdate(point.clientX || point.x, point.clientY || point.y);
                          }}
                          onDragEnd={() => {
                            handleDragEnd(pid);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 shadow-sm flex items-center gap-1 cursor-grab active:cursor-grabbing touch-none z-50`} 
                          style={{ backgroundColor: '#4f46e5' }}
                        >
                          <div className="flex items-center gap-1">
                            <span>{player.name}</span>
                            {player.position && <span className="opacity-70 text-[8px]">({player.position})</span>}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMovePlayer(exercise.id, pid, 'none');
                              }}
                              className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                              title="Ta bort från jokrar"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </motion.div>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })()}

            {attendingIds && attendingIds.length > 0 && (
              <div 
                data-team-id="none"
                className={`bg-zinc-50 dark:bg-zinc-950/30 p-6 rounded-3xl border border-dashed transition-all duration-200 flex flex-col h-full ${activeTargetId === 'none' ? 'scale-[1.02] border-indigo-500 bg-indigo-100/30 shadow-lg' : (draggedPlayerId ? 'border-zinc-300 dark:border-zinc-700 opacity-60' : 'border-zinc-200 dark:border-zinc-800')}`}
                style={{ zIndex: isUnassignedDragging ? 100 : (activeTargetId === 'none' ? 80 : (draggedPlayerId ? 10 : 1)), position: 'relative' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-700" />
                  <span className="font-black text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-tight flex-1">Ej indelade / Avbytare</span>
                  <div className="flex items-center gap-1.5 bg-zinc-200/50 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                    <Users size={12} className="text-zinc-500" />
                    <span className="text-xs font-black text-zinc-600 dark:text-zinc-400">
                      {unassignedPlayers.length}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[60px]">
                  {sortPlayersByPosition(unassignedPlayers.map(p => p.id), squad).map(pid => {
                    const player = squad.find(p => p.id === pid);
                    return player ? (
                      <motion.div 
                        key={pid} 
                        drag
                        dragSnapToOrigin
                        whileDrag={{ 
                          zIndex: 9999, 
                          scale: 1.1,
                          pointerEvents: 'none'
                        }}
                        onDragStart={() => setDraggedPlayerId(pid)}
                        onDrag={(e: any, info) => {
                          const point = (e.nativeEvent || e).clientX !== undefined ? (e.nativeEvent || e) : info.point;
                          handleDragUpdate(point.clientX || point.x, point.clientY || point.y);
                        }}
                        onDragEnd={() => {
                          handleDragEnd(pid);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-1 cursor-grab active:cursor-grabbing touch-none z-50 transition-colors hover:border-zinc-300`} 
                      >
                        {player.name}
                        {player.position && <span className="opacity-70 text-[8px]">({player.position})</span>}
                      </motion.div>
                    ) : null;
                  })}
                  {unassignedPlayers.length === 0 && (
                    <div className="w-full py-6 border-2 border-dashed border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center px-4">
                      Dra spelare hit för att plocka bort dem från momentet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {onStart && (
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
            <button
              onClick={() => {
                onClose();
                onStart();
              }}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none uppercase tracking-wide active:scale-[0.98]"
            >
              <Play size={20} fill="currentColor" />
              Starta tävlingsmoment nu
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
