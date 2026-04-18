import React from 'react';
import { Trophy, Clock, Trash2, ChevronRight, Plus, Copy, Edit2, GripVertical, ArrowUpDown, Gamepad2, Dice5, Target, Sword, Shield, Crown, Star, Heart, Zap, Flame, Ghost, Skull, Rocket, Car, Bike, Footprints, Dribbble, Music, Coffee, Calendar, Check } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Exercise } from '../types';

const ICON_MAP: Record<string, any> = {
  Trophy, Gamepad2, Dice5, Target, Sword, Shield, Crown, Star, Heart, Zap, Flame, Ghost, Skull, Rocket, Car, Bike, Footprints, Dribbble, Music, Coffee
};

interface GameListProps {
  exercises: Exercise[];
  onSelectExercise: (id: string) => void;
  onDeleteExercise: (id: string) => void;
  onCopyExercise: (id: string) => void;
  onEditExercise: (id: string) => void;
  onReorderExercises: (exercises: Exercise[]) => void;
  onNewExercise: () => void;
  key?: React.Key;
}

export default function GameList({ exercises, onSelectExercise, onDeleteExercise, onCopyExercise, onEditExercise, onReorderExercises, onNewExercise }: GameListProps) {
  const [exerciseToDelete, setExerciseToDelete] = React.useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = React.useState(false);

  const handleDeleteConfirm = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExerciseToDelete(id);
  };

  const confirmDelete = () => {
    if (exerciseToDelete) {
      onDeleteExercise(exerciseToDelete);
      setExerciseToDelete(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto sm:p-6 pb-32">
      <div className="flex items-center justify-end mb-6 sm:mb-8 px-4 sm:px-0 pt-4 sm:pt-0 gap-2">
          {exercises.length > 1 && (
            <button
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm sm:text-base border ${
                isReorderMode 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/30 dark:border-indigo-800' 
                  : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'
              }`}
              title={isReorderMode ? 'Avsluta sortering' : 'Sortera övningar'}
            >
              <ArrowUpDown size={18} className="sm:size-5" />
              <span className="hidden xs:inline">{isReorderMode ? 'Klar' : 'Sortera'}</span>
            </button>
          )}
          <button
            onClick={onNewExercise}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none text-sm sm:text-base"
          >
            <Plus size={18} className="sm:size-5" />
            Ny övning
          </button>
      </div>

      {exercises.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 mx-4 sm:mx-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-zinc-50 dark:bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-400">
            <Calendar size={24} className="sm:size-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">Inga övningar än</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 sm:mb-8">Skapa din första övning för att börja samla poäng!</p>
          <button
            onClick={onNewExercise}
            className="bg-indigo-600 text-white px-6 py-2.5 sm:px-8 sm:py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all text-sm sm:text-base"
          >
            Skapa övning
          </button>
        </div>
      ) : (
        <Reorder.Group 
          axis="y" 
          values={exercises} 
          onReorder={onReorderExercises}
          className="flex flex-col gap-2 sm:gap-4"
        >
          {exercises.map((exercise) => {
            const leader = [...exercise.teams].sort((a, b) => b.score - a.score)[0];
            const date = new Date(exercise.date || exercise.updatedAt).toLocaleDateString('sv-SE', {
              month: 'short',
              day: 'numeric',
            });
            const ExerciseIcon = ICON_MAP[exercise.icon] || Trophy;

            return (
              <Reorder.Item
                key={exercise.id}
                value={exercise}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                dragListener={isReorderMode}
                className={`group bg-white dark:bg-zinc-900 py-3 px-4 sm:rounded-2xl border-b sm:border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all flex items-center gap-3 sm:gap-4 w-full z-0 ${
                  isReorderMode ? 'cursor-grab active:cursor-grabbing active:scale-[0.98] active:shadow-lg' : 'cursor-pointer'
                }`}
                onClick={() => !isReorderMode && onSelectExercise(exercise.id)}
              >
                <AnimatePresence>
                  {isReorderMode && (
                    <motion.div 
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-zinc-300 dark:text-zinc-700 p-1 -ml-2 hover:text-zinc-400 transition-colors shrink-0 overflow-hidden"
                    >
                      <GripVertical size={20} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner"
                  style={{ backgroundColor: leader?.color || '#6366f1' }}
                >
                  <ExerciseIcon size={24} className="sm:size-7" fill="currentColor" />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="font-black text-base sm:text-xl text-zinc-900 dark:text-white truncate leading-tight mb-1">
                    {exercise.name}
                  </h3>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="sm:size-3" />
                        {date}
                      </span>
                      <span>•</span>
                      <span>{exercise.teams.length} lag</span>
                      {exercise.isFinished && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold">
                            <Check size={10} strokeWidth={3} className="sm:size-3" />
                            Avslutad
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditExercise(exercise.id);
                        }}
                        className="p-2 text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all"
                        title="Redigera"
                      >
                        <Edit2 size={18} className="sm:size-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyExercise(exercise.id);
                        }}
                        className="p-2 text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all"
                        title="Kopiera"
                      >
                        <Copy size={18} className="sm:size-5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteConfirm(e, exercise.id)}
                        className="p-2 text-zinc-200 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                        title="Radera"
                      >
                        <Trash2 size={18} className="sm:size-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-zinc-300 dark:text-zinc-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0">
                  <ChevronRight size={20} className="sm:size-6" />
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {exerciseToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setExerciseToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Radera övning?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                Är du säker på att du vill radera "{exercises.find(e => e.id === exerciseToDelete)?.name}"? Detta kan inte ångras.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmDelete}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Ja, radera
                </button>
                <button
                  onClick={() => setExerciseToDelete(null)}
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
