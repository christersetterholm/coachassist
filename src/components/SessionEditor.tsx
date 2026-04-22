import React, { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Clock, Calendar, Check, AlertCircle, ListTodo, Save, ChevronDown, ChevronUp, Play, PlusCircle, Users, Copy, UserPlus, X, ClipboardList, Edit2, LayoutList } from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { TrainingSession, SessionMoment, Exercise, SquadPlayer } from '../types';

interface SessionEditorProps {
  session: TrainingSession;
  exercises: Exercise[];
  squad?: SquadPlayer[];
  onUpdate: (updated: TrainingSession) => void;
  onClose: () => void;
  onCreateExercise?: (name: string, momentId: string) => string;
  onSelectExercise?: (id: string) => void;
  onEditExercise?: (id: string) => void;
  initialMode?: 'plan' | 'live';
  onModeChange?: (mode: 'plan' | 'live') => void;
}

interface MomentItemProps {
  moment: SessionMoment;
  details: any;
  mode: 'plan' | 'live';
  exercises: Exercise[];
  updateMoment: (id: string, updates: Partial<SessionMoment>) => void;
  removeMoment: (id: string) => void;
  onCreateExercise?: (name: string, momentId: string) => string;
  onSelectExercise?: (id: string) => void;
  onEditExercise?: (id: string) => void;
  onShowTeams?: (id: string) => void;
  key?: string;
}

function MomentItem({ 
  moment, 
  details, 
  mode, 
  exercises, 
  updateMoment, 
  removeMoment, 
  onCreateExercise, 
  onSelectExercise,
  onEditExercise,
  onShowTeams,
  onAddAfter 
}: MomentItemProps & { onAddAfter?: () => void }) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      key={moment.id}
      value={moment}
      dragListener={false}
      dragControls={dragControls}
      className="group relative bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800"
    >
      <div className="flex gap-4">
        {/* Time/Reorder indicator */}
        <div className="flex flex-col items-center gap-2 pt-1 select-none">
          {/* Enhanced Drag Handle for better touch response */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="p-3 -m-3 cursor-grab active:cursor-grabbing touch-none text-zinc-300 dark:text-zinc-700 hover:text-indigo-500 transition-colors"
          >
            <GripVertical size={24} />
          </div>
          
          <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 flex flex-col items-center pointer-events-none mt-2">
            <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md mb-0.5 whitespace-nowrap">{details.startTimeStr}</span>
            <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 my-0.5" />
            <span className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-1.5 py-0.5 rounded-md whitespace-nowrap">{details.endTimeStr}</span>
          </div>
        </div>
        {/* Main moment info */}
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {mode === 'plan' ? (
                <input
                  type="text"
                  value={moment.name}
                  onChange={(e) => updateMoment(moment.id, { name: e.target.value })}
                  className="w-full bg-transparent border-none p-0 text-lg font-black text-zinc-900 dark:text-white focus:ring-0"
                  placeholder="Namn på moment..."
                />
              ) : (
                <h4 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                  {moment.name || 'Namnlöst moment'}
                </h4>
              )}
            </div>
            <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
              <Clock size={12} className="text-zinc-400" />
              {mode === 'plan' ? (
                <input
                  type="number"
                  value={moment.duration}
                  onChange={(e) => updateMoment(moment.id, { duration: parseInt(e.target.value) || 0 })}
                  className="w-10 bg-transparent border-none p-0 text-sm font-black text-zinc-900 dark:text-white focus:ring-0 text-center"
                />
              ) : (
                <span className="text-sm font-black text-zinc-900 dark:text-white">{moment.duration}</span>
              )}
              <span className="text-[10px] font-bold text-zinc-400 uppercase">min</span>
            </div>
          </div>

          {mode === 'plan' ? (
            <textarea
              value={moment.description || ''}
              onChange={(e) => updateMoment(moment.id, { description: e.target.value })}
              className="w-full bg-transparent border-none p-0 text-sm text-zinc-500 dark:text-zinc-400 focus:ring-0 resize-none min-h-[60px]"
              placeholder="Beskriv vad som ska göras i det här momentet..."
            />
          ) : (
            moment.description && (
               <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                 {moment.description}
               </p>
            )
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-50 dark:border-zinc-950">
            {mode === 'plan' ? (
              <>
                <div className="relative">
                  <select
                    value={moment.exerciseId || ''}
                    onChange={(e) => updateMoment(moment.id, { exerciseId: e.target.value || undefined })}
                    className="appearance-none bg-zinc-50 dark:bg-zinc-950 text-[10px] font-bold text-zinc-500 px-3 py-1.5 pr-8 rounded-lg border border-zinc-100 dark:border-zinc-800 focus:ring-0 cursor-pointer max-w-[150px] truncate uppercase tracking-wider"
                  >
                    <option value="">Koppla övning...</option>
                    {exercises.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                </div>

                {onCreateExercise && !moment.exerciseId && (
                  <button
                    onClick={() => {
                      onCreateExercise(moment.name || 'Ny övning', moment.id);
                    }}
                    className="flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={12} />
                    Skapa ny övning
                  </button>
                )}
                {moment.exerciseId && onEditExercise && (
                  <button
                    onClick={() => onEditExercise(moment.exerciseId!)}
                    className="flex items-center gap-1 text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1.5 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                  >
                    <Edit2 size={12} />
                    Redigera
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                {moment.exerciseId && onSelectExercise && (
                  <>
                    <button
                      onClick={() => onSelectExercise(moment.exerciseId!)}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-[0.98]"
                    >
                      <Play fill="currentColor" size={14} />
                      STARTA ÖVNING
                    </button>
                    <button
                      onClick={() => onShowTeams && onShowTeams(moment.exerciseId!)}
                      className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
                      title="Visa lagöversikt"
                    >
                      <Users size={16} />
                    </button>
                  </>
                )}
                {moment.exerciseId && onEditExercise && (
                  <button
                    onClick={() => onEditExercise(moment.exerciseId!)}
                    className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
                    title="Redigera övning"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {mode === 'plan' && onAddAfter && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onAddAfter}
                  className="p-2 text-zinc-300 hover:text-indigo-500 transition-colors"
                  title="Lägg till moment under"
                >
                  <PlusCircle size={18} />
                </motion.button>
              )}
              <button
                onClick={() => removeMoment(moment.id)}
                className={`p-2 text-zinc-300 hover:text-red-500 transition-colors ${mode === 'plan' ? 'block' : 'hidden'}`}
                title="Ta bort moment"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

export default function SessionEditor({ 
  session, 
  exercises, 
  squad = [],
  onUpdate, 
  onClose, 
  onCreateExercise, 
  onSelectExercise,
  onEditExercise,
  initialMode = 'plan',
  onModeChange
}: SessionEditorProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedExerciseForTeams, setSelectedExerciseForTeams] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schema' | 'attendance'>('schema');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mode = initialMode;
  const setMode = onModeChange || (() => {});

  const totalPlannedMinutes = useMemo(() => session.moments.reduce((acc, m) => acc + m.duration, 0), [session.moments]);

  const momentDetails = useMemo(() => {
    let currentMinutes = 0;
    const [startH, startM] = session.startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(startH || 0, startM || 0, 0, 0);

    return session.moments.map(moment => {
      const momentStart = new Date(startDate.getTime() + currentMinutes * 60000);
      const momentEnd = new Date(momentStart.getTime() + moment.duration * 60000);
      
      const startTimeStr = momentStart.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      const endTimeStr = momentEnd.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      
      currentMinutes += moment.duration;
      
      return {
        ...moment,
        startTimeStr,
        endTimeStr
      };
    });
  }, [session.startTime, session.moments]);

  const calculatedEndTime = useMemo(() => {
    const [startH, startM] = session.startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(startH || 0, startM || 0, 0, 0);
    date.setMinutes(date.getMinutes() + totalPlannedMinutes);
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }, [session.startTime, totalPlannedMinutes]);

  const sessionDuration = useMemo(() => {
    if (!session.endTime) return totalPlannedMinutes;
    const [startH, startM] = session.startTime.split(':').map(Number);
    const [endH, endM] = session.endTime.split(':').map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    let diff = end - start;
    if (diff < 0) diff += 24 * 60; // Handle overnight (rare for training but still)
    return diff;
  }, [session.startTime, session.endTime, totalPlannedMinutes]);

  const timeStatus = useMemo(() => {
    if (!session.endTime) return { label: 'Sätt sluttid för att spåra tidsbudget', color: 'text-zinc-400' };
    const diff = sessionDuration - totalPlannedMinutes;
    if (diff === 0) return { label: 'Perfekt planerat!', color: 'text-green-500' };
    if (diff > 0) return { label: `${diff} min kvar att fylla`, color: 'text-amber-500' };
    return { label: `${Math.abs(diff)} min för mycket planerat`, color: 'text-red-500' };
  }, [sessionDuration, totalPlannedMinutes, session.endTime]);

  const addMoment = (index?: number) => {
    const newMoment: SessionMoment = {
      id: Math.random().toString(36).substring(7),
      name: '',
      duration: 10,
      description: ''
    };
    
    const newMoments = [...session.moments];
    if (typeof index === 'number') {
      newMoments.splice(index + 1, 0, newMoment);
    } else {
      newMoments.push(newMoment);
    }

    onUpdate({
      ...session,
      moments: newMoments,
      updatedAt: Date.now()
    });

    if (typeof index !== 'number') {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  };

  const updateMoment = (id: string, updates: Partial<SessionMoment>) => {
    onUpdate({
      ...session,
      moments: session.moments.map(m => m.id === id ? { ...m, ...updates } : m),
      updatedAt: Date.now()
    });
  };

  const removeMoment = (id: string) => {
    onUpdate({
      ...session,
      moments: session.moments.filter(m => m.id !== id),
      updatedAt: Date.now()
    });
  };

  const handleReorder = (newMoments: SessionMoment[]) => {
    onUpdate({
      ...session,
      moments: newMoments,
      updatedAt: Date.now()
    });
  };

  return (
    <div className="fixed inset-0 bg-zinc-50 dark:bg-black z-[60] flex flex-col">
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
                        {team.playerIds?.map(pid => {
                          const player = squad.find(p => p.id === pid);
                          return player ? (
                            <div key={pid} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm" style={{ backgroundColor: team.color }}>
                              {player.name}
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
                        {exercises.find(e => e.id === selectedExerciseForTeams)?.jokerPlayerIds?.map(pid => {
                          const player = squad.find(p => p.id === pid);
                          return player ? (
                            <div key={pid} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 shadow-sm">
                              {player.name}
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
                    onSelectExercise && onSelectExercise(id!);
                  }}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none uppercase tracking-wide active:scale-[0.98]"
                >
                  <Play size={20} fill="currentColor" />
                  Starta övning nu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-4 shrink-0">
        <button 
          onClick={onClose}
          className="p-2 -ml-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {mode === 'plan' ? (
            <input
              type="text"
              value={session.title}
              onChange={(e) => onUpdate({ ...session, title: e.target.value })}
              placeholder="Passets namn..."
              className="w-full bg-transparent border-none p-0 text-lg sm:text-xl font-black text-zinc-900 dark:text-white focus:ring-0 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 leading-tight uppercase"
            />
          ) : (
            <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white truncate uppercase">
              {session.title || 'Träning'}
            </h2>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <button
              onClick={() => mode === 'plan' && setShowTimePicker(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors ${
                mode === 'plan' 
                  ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700' 
                  : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30'
              }`}
            >
              <Calendar size={14} className={mode === 'plan' ? "text-zinc-400" : "text-indigo-400"} />
              <span className={`text-[10px] font-bold ${mode === 'plan' ? "text-zinc-700 dark:text-zinc-300" : "text-indigo-600 dark:text-indigo-400"}`}>
                {new Date(session.date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <div className={`w-px h-3 mx-1 ${mode === 'plan' ? "bg-zinc-200 dark:bg-zinc-700" : "bg-indigo-200 dark:bg-indigo-900/30"}`} />
              <Clock size={14} className={mode === 'plan' ? "text-zinc-400" : "text-indigo-400"} />
              <span className={`text-[10px] font-bold ${mode === 'plan' ? "text-zinc-700 dark:text-zinc-300" : "text-indigo-600 dark:text-indigo-400"}`}>
                {session.startTime} - {session.endTime || calculatedEndTime}
              </span>
            </button>

            <div className="flex p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 ml-0 sm:ml-auto">
              <button
                onClick={() => {
                  setMode('plan');
                  setActiveTab('schema');
                }}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                  activeTab === 'schema' && mode === 'plan' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-zinc-400'
                }`}
              >
                <Edit2 size={12} />
                Planera
              </button>
              <button
                onClick={() => {
                  setMode('live');
                  setActiveTab('schema');
                }}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                  activeTab === 'schema' && mode === 'live' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-zinc-400'
                }`}
              >
                <Play size={12} fill={activeTab === 'schema' && mode === 'live' ? 'currentColor' : 'none'} />
                Träna
              </button>
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                  activeTab === 'attendance' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-zinc-400'
                }`}
              >
                <Users size={12} />
                Deltagare
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="bg-indigo-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-bold flex items-center gap-2 text-xs sm:text-sm shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95 shrink-0"
        >
          <Save size={16} className="sm:size-18" />
          <span className="hidden xs:inline">Spara</span>
        </button>
      </div>

      <AnimatePresence>
        {showTimePicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowTimePicker(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Passinställningar</h3>
                <button onClick={() => setShowTimePicker(false)} className="text-zinc-400 hover:text-zinc-600 p-1">
                  <Check className="text-green-500" size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Datum</label>
                  <input
                    type="date"
                    value={new Date(session.date).toISOString().split('T')[0]}
                    onChange={(e) => onUpdate({ ...session, date: new Date(e.target.value).getTime() })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Starttid</label>
                    <input
                      type="time"
                      value={session.startTime}
                      onChange={(e) => onUpdate({ ...session, startTime: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Sluttid</label>
                    <input
                      type="time"
                      value={session.endTime || calculatedEndTime}
                      onChange={(e) => onUpdate({ ...session, endTime: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-zinc-500 uppercase">Tid nyttjad</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${session.endTime && totalPlannedMinutes > sessionDuration ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          {totalPlannedMinutes} {session.endTime ? `/ ${sessionDuration}` : ''} min
                      </span>
                  </div>
                  {session.endTime && (
                    <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-500 ${totalPlannedMinutes > sessionDuration ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, (totalPlannedMinutes / sessionDuration) * 100)}%` }}
                        />
                    </div>
                  )}
                  {timeStatus && (
                      <p className={`text-[10px] font-bold mt-2 text-center ${timeStatus.color}`}>
                          {timeStatus.label}
                      </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6"
      >
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {activeTab === 'schema' ? (
            <>
              {mode === 'plan' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Clock size={16} />
                      </div>
                      <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">Tidsanvändning</span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${session.endTime && totalPlannedMinutes > sessionDuration ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {totalPlannedMinutes} {session.endTime ? `/ ${sessionDuration}` : ''} min
                    </span>
                  </div>
                  {session.endTime && (
                    <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${totalPlannedMinutes > sessionDuration ? 'bg-red-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, (totalPlannedMinutes / sessionDuration) * 100)}%` }}
                      />
                    </div>
                  )}
                  {timeStatus && (
                    <p className={`text-[10px] font-bold mt-2 text-center ${timeStatus.color}`}>
                      {timeStatus.label}
                    </p>
                  )}
                </motion.div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <ListTodo size={16} />
                  Schema ({totalPlannedMinutes} minuter)
                </h3>
                {mode === 'plan' && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => addMoment()}
                    className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
                  >
                    <Plus size={16} />
                    Lägg till moment
                  </motion.button>
                )}
              </div>

              <Reorder.Group axis="y" values={session.moments} onReorder={handleReorder} className="space-y-4">
                {session.moments.map((moment, index) => (
                  <MomentItem
                    key={moment.id}
                    moment={moment}
                    details={momentDetails[index]}
                    mode={mode}
                    exercises={exercises}
                    updateMoment={updateMoment}
                    removeMoment={removeMoment}
                    onCreateExercise={onCreateExercise}
                    onSelectExercise={onSelectExercise}
                    onEditExercise={onEditExercise}
                    onShowTeams={(id) => setSelectedExerciseForTeams(id)}
                    onAddAfter={() => addMoment(index)}
                  />
                ))}
              </Reorder.Group>

              {session.moments.length > 0 && mode === 'plan' && (
                <div className="pt-4 pb-12 flex justify-center">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addMoment()}
                    className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors shadow-sm"
                  >
                    <PlusCircle size={18} />
                    Lägg till moment längst ner
                  </motion.button>
                </div>
              )}

              {session.moments.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                  <p className="text-zinc-400 text-sm font-medium mb-4">Inga moment tillagda än</p>
                  <button
                    onClick={() => addMoment()}
                    className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-200"
                  >
                    Lägg till första momentet
                  </button>
                </div>
              )}
            </>
          ) : (
            <ParticipantManager 
              session={session} 
              squad={squad} 
              onUpdate={(updatedAttendance) => onUpdate({ ...session, attendance: updatedAttendance, updatedAt: Date.now() })} 
            />
          )}
          
          <div className="pb-32" />
        </div>
      </div>
    </div>
  );
}

function ParticipantManager({ 
  session, 
  squad, 
  onUpdate 
}: { 
  session: TrainingSession, 
  squad: SquadPlayer[], 
  onUpdate: (updated: string[]) => void 
}) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const attendance = session.attendance || [];

  const handleTogglePlayer = (id: string) => {
    const newAttendance = attendance.includes(id)
      ? attendance.filter(pid => pid !== id)
      : [...attendance, id];
    onUpdate(newAttendance);
  };

  const handlePaste = () => {
    const lines = pasteValue.split(/[\n,;]/);
    const parsedNames = lines
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const matchedIds = parsedNames.map(name => {
      const found = squad.find(p => p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()));
      return found ? found.id : name;
    });

    const combined = Array.from(new Set([...attendance, ...matchedIds]));
    onUpdate(combined);
    setPasteMode(false);
    setPasteValue("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Users size={16} />
            Närvarande ({attendance.length})
          </h3>
          <p className="text-[10px] text-zinc-500 font-medium mt-1">Välj spelare från truppen eller klistra in en lista</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPasteMode(true)}
            className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline"
          >
            <ClipboardList size={14} />
            Klistra in
          </button>
          <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-800 mx-1" />
          <button
            onClick={() => onUpdate(squad.map(p => p.id))}
            className="text-zinc-400 hover:text-indigo-600 font-bold text-[10px] uppercase"
          >
            Alla närvarande
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {squad.map(player => {
          const isPresent = attendance.includes(player.id);
          return (
            <button
              key={player.id}
              onClick={() => handleTogglePlayer(player.id)}
              className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group ${
                isPresent 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isPresent ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-zinc-600'
              }`}>
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-[10px] font-black uppercase">{player.name.substring(0, 1)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-black truncate uppercase ${isPresent ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {player.name}
                </p>
                {player.number && (
                  <p className="text-[10px] font-bold text-zinc-400">#{player.number}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {attendance.some(id => !squad.find(p => p.id === id)) && (
        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Manuellt tillagda / Ej i trupp</h4>
          <div className="flex flex-wrap gap-2">
            {attendance.filter(id => !squad.find(p => p.id === id)).map(name => (
              <div key={name} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">{name}</span>
                <button 
                  onClick={() => onUpdate(attendance.filter(id => id !== name))}
                  className="text-zinc-400 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paste Modal */}
      <AnimatePresence>
        {pasteMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4 text-left"
            onClick={() => setPasteMode(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Klistra in deltagare</h3>
                  <p className="text-xs text-zinc-500 font-medium">Klistra in namn från t.ex. Svenska Lag, SportAdmin eller liknande</p>
                </div>
              </div>

              <textarea
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="Klistra in lista på namn här (separera med radbyte eller kommatecken)..."
                className="w-full h-48 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-6"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setPasteMode(false)}
                  className="flex-1 py-4 px-6 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors uppercase text-xs"
                >
                  Avbryt
                </button>
                <button
                  onClick={handlePaste}
                  className="flex-[2] py-4 px-6 rounded-2xl font-black bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all uppercase text-xs"
                >
                  Lägg till deltagare
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
