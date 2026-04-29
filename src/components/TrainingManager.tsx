import React, { useState } from 'react';
import { Calendar, Plus, Trophy, Clock, Trash2, Edit2, Copy, Check, ChevronRight, LayoutList, Dribbble, History, MoreVertical, ListTodo, GripVertical, Users, Play, FileText } from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Exercise, TrainingSession } from '../types';
import { sortPlayersByPosition } from '../lib/teamUtils';
import GameList from './GameList';

interface TrainingManagerProps {
  exercises: Exercise[];
  sessions: TrainingSession[];
  squad: any[];
  onSelectExercise: (id: string) => void;
  onDeleteExercise: (id: string) => void;
  onCopyExercise: (id: string) => void;
  onEditExercise: (id: string) => void;
  onReorderExercises: (exercises: Exercise[]) => void;
  onNewExercise: () => void;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onCopySession: (id: string) => void;
  onReorderSessions: (sessions: TrainingSession[]) => void;
  onUpdateSession: (updated: TrainingSession) => void;
}

function SessionItem({ 
  session, 
  date, 
  totalMinutes, 
  onSelectSession, 
  setSessionToDelete,
  onCopySession,
  onUpdateSession 
}: { 
  session: TrainingSession, 
  date: string, 
  totalMinutes: number, 
  onSelectSession: (id: string) => void, 
  setSessionToDelete: (id: string) => void,
  onCopySession: (id: string) => void,
  onUpdateSession: (updated: TrainingSession) => void,
  key?: string
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      key={session.id}
      value={session}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden active:scale-[0.98] active:shadow-lg z-0"
      onClick={() => onSelectSession(session.id)}
    >
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Enhanced Drag Handle for better touch response */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="p-3 -ml-3 cursor-grab active:cursor-grabbing touch-none text-zinc-300 dark:text-zinc-700 hover:text-indigo-500 transition-colors"
        >
          <GripVertical size={24} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors uppercase">
                {session.title || 'Träning'}
              </h3>
              <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1 text-[11px] sm:text-xs text-zinc-500 font-medium">
                <span className="flex items-center gap-1 capitalize whitespace-nowrap">
                  <Calendar size={13} className="text-zinc-400 shrink-0" />
                  {date}
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Clock size={13} className="text-zinc-400 shrink-0" />
                  {session.startTime} ({totalMinutes} min)
                </span>
                {session.notes && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <FileText size={14} />
                    Anteckningar
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={20} className="text-zinc-300 group-hover:text-indigo-600 transition-colors shrink-0" />
          </div>

          <div className="flex items-center gap-1 text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
            <ListTodo size={12} />
            {session.moments.length} moment
            <div className="mx-2 h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
            <div className="flex items-center gap-2">
              {!session.isCompleted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateSession({ ...session, isCompleted: true });
                  }}
                  className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded-lg border border-green-100 dark:border-green-900/30 hover:bg-green-100 transition-all font-black"
                >
                  <Check size={12} strokeWidth={3} />
                  Klarmarkera
                </button>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopySession(session.id);
                  }}
                  className="p-1 hover:text-indigo-500 transition-colors"
                  title="Kopiera träningspass"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionToDelete(session.id);
                  }}
                  className="p-1 hover:text-red-500 transition-colors"
                  title="Radera träningspass"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Progress indicator or simple moment preview */}
          <div className="mt-3 flex gap-1 h-1">
            {session.moments.map((m, i) => (
              <div 
                key={i} 
                className="h-full rounded-full bg-indigo-100 dark:bg-indigo-900/30"
                style={{ flex: m.duration }}
              />
            ))}
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

export default function TrainingManager({
  exercises,
  sessions,
  squad,
  onSelectExercise,
  onDeleteExercise,
  onCopyExercise,
  onEditExercise,
  onReorderExercises,
  onNewExercise,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onCopySession,
  onReorderSessions,
  onUpdateSession
}: TrainingManagerProps) {
  const [activeTab, setActiveTab ] = useState<'planned' | 'completed' | 'exercises'>('planned');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [selectedExerciseForTeams, setSelectedExerciseForTeams] = useState<string | null>(null);

  const handleReorder = (newOrder: TrainingSession[]) => {
    onReorderSessions(newOrder);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-32 pt-4">
      {/* Team Overview Modal */}
      <AnimatePresence>
        {selectedExerciseForTeams && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6"
            onClick={() => setSelectedExerciseForTeams(null)}
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
                      {exercises.find(e => e.id === selectedExerciseForTeams)?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedExerciseForTeams(null)}
                  className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-xl transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exercises.find(e => e.id === selectedExerciseForTeams)?.teams.filter(t => (t.playerIds?.length || 0) > 0).map((team, idx) => (
                    <div key={team.id} className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex flex-col h-full">
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
                      <div className="flex flex-wrap gap-2">
                        {sortPlayersByPosition(team.playerIds || [], squad).map(pid => {
                          const player = squad.find(p => p.id === pid);
                          return player ? (
                            <div key={pid} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm" style={{ backgroundColor: team.color }}>
                              {player.name}
                              {player.position && <span className="ml-1 opacity-70 text-[8px]">({player.position})</span>}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}

                  {(exercises.find(e => e.id === selectedExerciseForTeams)?.jokerPlayerIds?.length || 0) > 0 && (
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col h-full shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-4 h-4 rounded-full bg-indigo-600 shadow-sm" />
                        <span className="font-black text-sm text-indigo-900 dark:text-indigo-100 uppercase tracking-tight flex-1">Jokrar</span>
                        <div className="flex items-center gap-1.5 bg-indigo-200/50 dark:bg-indigo-900/50 px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-400">
                          <Users size={12} />
                          <span className="text-xs font-black">
                            {exercises.find(e => e.id === selectedExerciseForTeams)?.jokerPlayerIds?.length}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sortPlayersByPosition(exercises.find(e => e.id === selectedExerciseForTeams)?.jokerPlayerIds || [], squad).map(pid => {
                          const player = squad.find(p => p.id === pid);
                          return player ? (
                            <div key={pid} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 shadow-sm">
                              {player.name}
                              {player.position && <span className="ml-1 opacity-70 text-[8px]">({player.position})</span>}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
                <button
                  onClick={() => {
                    const id = selectedExerciseForTeams;
                    setSelectedExerciseForTeams(null);
                    onSelectExercise(id!);
                  }}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none uppercase tracking-wide active:scale-[0.98]"
                >
                  <Play size={20} fill="currentColor" />
                  Starta tävlingsmoment nu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Switcher */}
      <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl mb-4 sm:mb-8 mx-4 sm:mx-0">
        <button
          onClick={() => setActiveTab('planned')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-1 rounded-xl text-[10px] sm:text-sm font-black uppercase tracking-tight sm:tracking-normal sm:capitalize sm:font-bold transition-all ${
            activeTab === 'planned'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Calendar size={16} className="hidden sm:block" />
          <span>Planerade</span>
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-1 rounded-xl text-[10px] sm:text-sm font-black uppercase tracking-tight sm:tracking-normal sm:capitalize sm:font-bold transition-all ${
            activeTab === 'completed'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <History size={16} className="hidden sm:block" />
          <span>Genomförda</span>
        </button>
        <button
          onClick={() => setActiveTab('exercises')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-1 rounded-xl text-[10px] sm:text-sm font-black uppercase tracking-tight sm:tracking-normal sm:capitalize sm:font-bold transition-all ${
            activeTab === 'exercises'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Trophy size={16} className="hidden sm:block" />
          <span>Tävling</span>
        </button>
      </div>

      {activeTab !== 'exercises' ? (
        <div className="px-4 sm:px-0">
          <div className="flex items-center justify-between mb-6 gap-4">
            <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
              {activeTab === 'planned' ? 'Planerade träningspass' : 'Genomförda träningspass'}
            </h2>
            <button
              onClick={onNewSession}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none text-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Planera träningspass</span>
              <span className="sm:hidden">Planera</span>
            </button>
          </div>

          {[...sessions].filter(s => activeTab === 'completed' ? s.isCompleted : !s.isCompleted).length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-400">
                <Calendar size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">
                Inga {activeTab === 'completed' ? 'genomförda' : 'planerade'} träningspass
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                {activeTab === 'completed' 
                  ? 'När du markerar ett träningspass som genomfört hamnar det här.'
                  : 'Börja planera din nästa träning genom att lägga till tävlingsmoment och tider.'}
              </p>
              {activeTab === 'planned' && (
                <button
                  onClick={onNewSession}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                >
                  Planera ditt första träningspass
                </button>
              )}
            </div>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={sessions.filter(s => activeTab === 'completed' ? s.isCompleted : !s.isCompleted)} 
              onReorder={(newOrder) => {
                // We need to merge the reordered filtered list back into the main list
                const otherCategory = sessions.filter(s => activeTab === 'completed' ? !s.isCompleted : s.isCompleted);
                onReorderSessions([...newOrder, ...otherCategory]);
              }} 
              className="grid gap-4"
            >
              {[...sessions]
                .filter(s => activeTab === 'completed' ? s.isCompleted : !s.isCompleted)
                .map((session) => {
                  const date = new Date(session.date).toLocaleDateString('sv-SE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  });
                  const totalMinutes = session.moments.reduce((acc, m) => acc + m.duration, 0);

                  return (
                    <SessionItem
                      key={session.id}
                      session={session}
                      date={date}
                      totalMinutes={totalMinutes}
                      onSelectSession={onSelectSession}
                      setSessionToDelete={setSessionToDelete}
                      onCopySession={onCopySession}
                      onUpdateSession={onUpdateSession}
                    />
                  );
                })}
            </Reorder.Group>
          )}
        </div>
      ) : (
        <GameList
          exercises={exercises}
          sessions={sessions}
          onSelectExercise={onSelectExercise}
          onDeleteExercise={onDeleteExercise}
          onCopyExercise={onCopyExercise}
          onEditExercise={onEditExercise}
          onReorderExercises={onReorderExercises}
          onNewExercise={onNewExercise}
          onShowTeams={(id) => setSelectedExerciseForTeams(id)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {sessionToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setSessionToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Radera träningspass?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 font-medium">
                Är du säker på att du vill radera "{sessions.find(s => s.id === sessionToDelete)?.title}"? Detta tar bort planeringen permanent.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    onDeleteSession(sessionToDelete);
                    setSessionToDelete(null);
                  }}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Ja, radera
                </button>
                <button
                  onClick={() => setSessionToDelete(null)}
                  className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
