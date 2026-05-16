import React, { useState } from 'react';
import { Calendar, Plus, Trophy, Clock, Trash2, Edit2, Copy, Check, ChevronRight, LayoutList, Dribbble, History, MoreVertical, ListTodo, GripVertical, Users, Play, FileText, Settings, X, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Exercise, TrainingSession, TrainingSettings } from '../types';
import { sortPlayersByPosition } from '../lib/teamUtils';
import GameList from './GameList';
import TeamOverviewModal from './TeamOverviewModal';

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
  onMovePlayer: (exerciseId: string, playerId: string, targetTeamId: string) => void;
  activeTab: 'planned' | 'completed' | 'exercises';
  onTabChange: (tab: 'planned' | 'completed' | 'exercises') => void;
  settings?: TrainingSettings;
  onUpdateSettings?: (settings: TrainingSettings) => void;
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
      className="group bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden active:scale-[0.98] active:shadow-lg z-0"
      onClick={() => onSelectSession(session.id)}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Drag Handle */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="mt-1.5 p-1 -ml-1 cursor-grab active:cursor-grabbing touch-none text-zinc-300 dark:text-zinc-700 hover:text-indigo-500 transition-colors"
        >
          <GripVertical size={20} />
        </div>

        {/* Date Badge */}
        <div className="flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-2.5 py-1 min-w-[58px] border border-zinc-100 dark:border-zinc-800/50 shrink-0 shadow-sm">
          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase leading-none mb-0.5">
            {new Date(session.date).toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '').slice(0, 3)}
          </span>
          <span className="text-xl font-black text-zinc-900 dark:text-white leading-none">
            {new Date(session.date).getDate()}
          </span>
          <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase leading-none mt-0.5">
            {new Date(session.date).toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '').slice(0, 3)}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <h3 className="text-base font-black text-zinc-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase truncate">
              {session.title || 'Träning'}
            </h3>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-bold capitalize">
            <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg shrink-0 border border-indigo-100 dark:border-indigo-900/30">
              <Clock size={12} strokeWidth={3} />
              <span>
                {session.startTime} - {session.endTime || (() => {
                  const [h, m] = session.startTime.split(':').map(Number);
                  const end = new Date(0, 0, 0, h, m + totalMinutes);
                  return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
                })()}
              </span>
            </div>
            
            {/* Completion Button moved up */}
            <div className="shrink-0">
              {session.isCompleted ? (
                <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-lg border border-green-100 dark:border-green-900/30 font-black text-[10px] uppercase">
                  <Check size={11} strokeWidth={3} />
                  <span>Klar</span>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateSession({ ...session, isCompleted: true });
                  }}
                  className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-lg border border-green-100 dark:border-green-900/30 hover:bg-green-100 transition-all font-black text-[10px] uppercase shadow-sm active:scale-95"
                >
                  <Check size={11} strokeWidth={3} />
                  <span>Klar?</span>
                </button>
              )}
            </div>

            {session.notes && (
              <span className="flex items-center gap-1 text-amber-500 shrink-0">
                <FileText size={12} />
                Anteckningar
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-50 dark:border-zinc-800/50">
        <div className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-bold">
          <ListTodo size={12} />
          <span>{session.moments.length} moment</span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span>{totalMinutes} min</span>
          
          <div className="mx-2 h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopySession(session.id);
                }}
                className="p-1.5 text-zinc-400 hover:text-indigo-500 transition-colors bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg"
                title="Kopiera träningspass"
              >
                <Copy size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSessionToDelete(session.id);
                }}
                className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg"
                title="Radera träningspass"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Progress preview */}
        <div className="mt-2.5 flex gap-1 h-1">
          {session.moments.map((m, i) => (
            <div 
              key={i} 
              className="h-full rounded-full bg-indigo-100 dark:bg-indigo-900/20"
              style={{ flex: m.duration }}
            />
          ))}
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
  onUpdateSession,
  onMovePlayer,
  activeTab,
  onTabChange,
  settings,
  onUpdateSettings
}: TrainingManagerProps) {
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [selectedExerciseForTeams, setSelectedExerciseForTeams] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Local state for settings editing to avoid immediate sync noise
  const [localStartTime, setLocalStartTime] = useState(settings?.defaultStartTime || '18:00');
  const [localDuration, setLocalDuration] = useState(settings?.defaultDuration || 90);
  const [localEndTime, setLocalEndTime] = useState(settings?.defaultEndTime || '19:30');

  const calculateEndTime = (start: string, duration: number) => {
    const [h, m] = start.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + duration);
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff;
  };

  const handleReorder = (newOrder: TrainingSession[]) => {
    onReorderSessions(newOrder);
  };

  const sortSessionsByDate = () => {
    const sorted = [...sessions].sort((a, b) => {
      // Sort by date first
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      
      // If same date, sort by start time
      return a.startTime.localeCompare(b.startTime);
    });
    onReorderSessions(sorted);
  };

  const currentExerciseForTeams = exercises.find(e => e.id === selectedExerciseForTeams);

  return (
    <div className="w-full max-w-4xl mx-auto mb-32 pt-4">
      {/* Team Overview Modal */}
      <AnimatePresence>
        {selectedExerciseForTeams && currentExerciseForTeams && (
          <TeamOverviewModal
            exercise={currentExerciseForTeams}
            squad={[...squad, ...(sessions.find(s => s.moments.some(m => m.exerciseId === selectedExerciseForTeams))?.guestPlayers || [])]}
            onMovePlayer={onMovePlayer}
            onClose={() => setSelectedExerciseForTeams(null)}
            onAddGuest={(name) => {
              const session = sessions.find(s => s.moments.some(m => m.exerciseId === selectedExerciseForTeams));
              if (session) {
                const newGuest = {
                  id: `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  name: name.trim(),
                };
                onUpdateSession({
                  ...session,
                  guestPlayers: [...(session.guestPlayers || []), newGuest],
                  attendance: [...(session.attendance || []), newGuest.id],
                  updatedAt: Date.now()
                });
              }
            }}
            onStart={() => {
              const id = selectedExerciseForTeams;
              setSelectedExerciseForTeams(null);
              onSelectExercise(id);
            }}
          />
        )}
      </AnimatePresence>

      {/* Tab Switcher */}
      <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl mb-4 sm:mb-8 mx-4 sm:mx-0">
        <button
          onClick={() => onTabChange('planned')}
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
          onClick={() => onTabChange('completed')}
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
          onClick={() => onTabChange('exercises')}
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
            <div className="flex items-center gap-2">
              <button
                onClick={sortSessionsByDate}
                className="p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl shadow-sm tooltip"
                title="Sortera efter datum"
              >
                <ArrowUpDown size={20} />
              </button>
              <button
                onClick={() => {
                  setLocalStartTime(settings?.defaultStartTime || '18:00');
                  setLocalDuration(settings?.defaultDuration || 90);
                  setLocalEndTime(settings?.defaultEndTime || calculateEndTime(settings?.defaultStartTime || '18:00', settings?.defaultDuration || 90));
                  setShowSettings(true);
                }}
                className="p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl shadow-sm"
                title="Inställningar för träning"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={onNewSession}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none text-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Planera träningspass</span>
                <span className="sm:hidden">Planera</span>
              </button>
            </div>
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

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 text-left"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Standardtider</h3>
                <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Standard starttid</label>
                  <input
                    type="time"
                    value={localStartTime}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setLocalStartTime(newStart);
                      setLocalEndTime(calculateEndTime(newStart, localDuration));
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Standardlängd (minuter)</label>
                  <input
                    type="number"
                    value={localDuration}
                    onChange={(e) => {
                      const newDur = parseInt(e.target.value) || 0;
                      setLocalDuration(newDur);
                      setLocalEndTime(calculateEndTime(localStartTime, newDur));
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Standard sluttid</label>
                  <input
                    type="time"
                    value={localEndTime}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setLocalEndTime(newEnd);
                      setLocalDuration(calculateDuration(localStartTime, newEnd));
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    onUpdateSettings?.({
                      defaultStartTime: localStartTime,
                      defaultEndTime: localEndTime,
                      defaultDuration: localDuration
                    });
                    setShowSettings(false);
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all uppercase text-xs shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  Spara inställningar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
