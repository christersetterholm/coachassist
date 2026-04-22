import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Share2, Crown, Star, Medal, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Lock, Trash2, Loader2, ExternalLink, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SquadPlayer, Exercise, Period, PeriodStandings } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { calculateLeaderboard } from '../lib/leaderboardUtils';

interface LeaderboardProps {
  squad: SquadPlayer[];
  exercises: Exercise[];
  periods: Period[];
  currentPeriodId: string | null;
  onClosePeriod: (name: string, standings: PeriodStandings[]) => void;
  onStartNewPeriod: () => void;
  onDeletePeriod: (id: string) => void;
  onCreatePeriod: (name: string) => void;
  onSwitchPeriod: (id: string) => void;
  onRenamePeriod: (id: string, newName: string) => void;
  onUpdatePeriod: (id: string, updates: Partial<Period>) => void;
  sharedId?: string | null;
  userUid?: string | null;
  key?: React.Key;
}

export default function Leaderboard({ 
  squad, 
  exercises, 
  periods, 
  currentPeriodId, 
  onClosePeriod, 
  onStartNewPeriod, 
  onDeletePeriod,
  onCreatePeriod,
  onSwitchPeriod,
  onRenamePeriod,
  onUpdatePeriod,
  sharedId,
  userUid
}: LeaderboardProps) {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | 'current'>(currentPeriodId || 'current');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [sharedData, setSharedData] = useState<any>(null);
  const [isLoadingShared, setIsLoadingShared] = useState(!!sharedId);

  useEffect(() => {
    if (sharedId) {
      const fetchShared = async () => {
        setIsLoadingShared(true);
        try {
          const docRef = doc(db, 'shared_leaderboards', sharedId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSharedData(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching shared leaderboard:", error);
        } finally {
          setIsLoadingShared(false);
        }
      };
      fetchShared();
    }
  }, [sharedId]);

  useEffect(() => {
    if (!sharedId && currentPeriodId && selectedPeriodId === 'current') {
      setSelectedPeriodId(currentPeriodId);
    }
  }, [currentPeriodId, sharedId]);

  // Effect to keep shared leaderboard in sync
  useEffect(() => {
    const period = periods.find(p => p.id === selectedPeriodId);
    if (!sharedId && period?.shareId && userUid) {
      const syncShared = async () => {
        try {
          const stats = calculateLeaderboard(squad, exercises, selectedPeriodId);
          const dataToUpdate = {
            id: period.shareId,
            name: period.name,
            standings: stats.map((p: any) => ({
              playerId: p.id,
              playerName: p.name,
              points: p.totalPoints,
              history: p.history || []
            })),
            updatedAt: Date.now(),
            startDate: period.startDate || null,
            endDate: period.endDate || null,
            coachUid: userUid
          };
          await setDoc(doc(db, 'shared_leaderboards', period.shareId!), dataToUpdate, { merge: true });
        } catch (error) {
          console.error("Error syncing shared leaderboard:", error);
        }
      };
      
      const timeoutId = setTimeout(syncShared, 2000); // Debounce
      return () => clearTimeout(timeoutId);
    }
  }, [squad, exercises, selectedPeriodId, periods, sharedId, userUid]);

  // Get the relevant exercises for the selected view
  const playerStats = calculateLeaderboard(squad, exercises, selectedPeriodId);

  // For historical periods, we might want to use the saved standings instead of recalculating
  // but recalculating is fine if the exercises are still there.
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
  const displayStats = (selectedPeriod && selectedPeriod.endDate) 
    ? selectedPeriod.standings.map(s => ({
        id: s.playerId,
        name: s.playerName,
        totalPoints: s.points,
        history: [] // History might not be available for archived periods if exercises are deleted, but here they are kept
      })).sort((a, b) => b.totalPoints - a.totalPoints)
    : playerStats;

  const handleCreateConfirm = () => {
    if (!newPeriodName.trim()) return;
    onCreatePeriod(newPeriodName);
    setShowCreateModal(false);
    setNewPeriodName('');
  };

  const handleRenameConfirm = () => {
    if (!renameValue.trim() || selectedPeriodId === 'current') return;
    onRenamePeriod(selectedPeriodId, renameValue);
    setShowRenameModal(false);
  };

  const handleCloseConfirm = () => {
    if (selectedPeriodId === 'current') return;
    const standings: PeriodStandings[] = playerStats
      .filter(p => p.totalPoints > 0)
      .map(p => ({
        playerId: p.id,
        playerName: p.name,
        points: p.totalPoints
      }));
    
    onClosePeriod('', standings); // Name is already set for the period
    setShowCloseModal(false);
  };

  const handleDeleteConfirm = () => {
    if (selectedPeriodId === 'current') return;
    onDeletePeriod(selectedPeriodId);
    setShowDeleteModal(false);
    setSelectedPeriodId('current');
  };

  const togglePlayer = (playerId: string) => {
    const newExpanded = new Set(expandedPlayers);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedPlayers(newExpanded);
    
    // If we manually toggle, we might need to sync allExpanded state
    if (newExpanded.size === playerStats.length) {
      setAllExpanded(true);
    } else if (newExpanded.size === 0) {
      setAllExpanded(false);
    }
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedPlayers(new Set());
      setAllExpanded(false);
    } else {
      setExpandedPlayers(new Set(playerStats.map(p => p.id)));
      setAllExpanded(true);
    }
  };

  const handleShare = async () => {
    if (sharedId) return; // Don't share from a shared view

    setIsSharing(true);
    try {
      const period = periods.find(p => p.id === selectedPeriodId);
      
      // Generate a shorter ID if it doesn't exist
      const generateShortId = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const id = period?.shareId || generateShortId();
      const name = period?.name || 'Poängliga';
      
      const dataToShare = {
        id,
        name,
        standings: displayStats.map((p: any) => ({
          playerId: p.id,
          playerName: p.name,
          points: p.totalPoints,
          history: p.history || []
        })),
        createdAt: Date.now(),
        startDate: period?.startDate || null,
        endDate: period?.endDate || null,
        coachUid: userUid
      };

      await setDoc(doc(db, 'shared_leaderboards', id), dataToShare);

      // Save shareId to period if it's new
      if (period && !period.shareId) {
        onUpdatePeriod(period.id, { shareId: id });
      }

      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${id}`;

      if (navigator.share) {
        await navigator.share({
          title: `Poängligan: ${name}`,
          text: `Kolla in ställningen i ${name}!`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Länk kopierad till urklipp!');
      }
    } catch (error) {
      console.error("Error sharing leaderboard:", error);
      alert('Kunde inte skapa delningslänk. Kontrollera att du är inloggad.');
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoadingShared) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-zinc-500 font-bold">Laddar poängliga...</p>
      </div>
    );
  }

  if (sharedId && !sharedData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center text-red-600 dark:text-red-400 mb-6">
          <Trash2 size={40} />
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Länken hittades inte</h3>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-xs">
          Denna poängliga kan ha tagits bort eller så är länken felaktig.
        </p>
      </div>
    );
  }

  const finalStats = sharedData 
    ? sharedData.standings.map((s: any) => ({
        id: s.playerId,
        name: s.playerName,
        totalPoints: s.points,
        history: s.history || []
      }))
    : displayStats;

  const title = sharedData ? sharedData.name : 'Poängligan';

  const getSubtitle = (player: any) => {
    if (player.history && player.history.length > 0) {
      return `${player.history.length} övningar med poäng`;
    }
    if (sharedId) {
      return 'Inga poäng registrerade';
    }
    const period = periods.find(p => p.id === selectedPeriodId);
    return period?.endDate ? 'Slutställning' : 'Inga poäng än';
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-32">
      <div className="flex flex-col mb-8 gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {!sharedId ? (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 min-w-0">
                    <select 
                      value={selectedPeriodId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedPeriodId(id);
                      }}
                      className="w-full bg-transparent border-none text-zinc-900 dark:text-white font-black text-xl sm:text-2xl focus:ring-0 outline-none cursor-pointer hover:text-indigo-600 transition-colors p-0 appearance-none pr-8"
                    >
                      <option value="current" disabled>Välj tävling...</option>
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.isActive ? '(Aktiv)' : p.endDate ? '(Avslutad)' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                      <ChevronDown size={20} />
                    </div>
                  </div>
                  {selectedPeriodId !== 'current' && !periods.find(p => p.id === selectedPeriodId)?.endDate && (
                    <button 
                      type="button"
                      onClick={() => {
                        const p = periods.find(period => period.id === selectedPeriodId);
                        if (p) {
                          setRenameValue(p.name);
                          setShowRenameModal(true);
                        }
                      }}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all active:scale-90 active:bg-zinc-200 dark:active:bg-zinc-700 shadow-sm relative z-20"
                      title="Redigera namn"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
              ) : null}
          </div>

          {!sharedId && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm text-sm"
              >
                <Plus size={18} />
                <span className="hidden xs:inline">Ny tävling</span>
                <span className="xs:hidden">Ny</span>
              </button>

              {selectedPeriodId !== 'current' && 
               !periods.find(p => p.id === selectedPeriodId)?.isActive && 
               !periods.find(p => p.id === selectedPeriodId)?.endDate && (
                <button
                  onClick={() => onSwitchPeriod(selectedPeriodId)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 transition-all shadow-sm text-sm"
                >
                  <Check size={18} />
                  <span>Aktivera</span>
                </button>
              )}

              {selectedPeriodId !== 'current' && !periods.find(p => p.id === selectedPeriodId)?.endDate && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-sm text-sm"
                >
                  <Lock size={18} />
                  <span>Avsluta</span>
                </button>
              )}
              {selectedPeriodId !== 'current' && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl font-bold border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all shadow-sm text-sm"
                >
                  <Trash2 size={18} />
                  <span>Ta bort</span>
                </button>
              )}

              <div className="w-[1px] h-6 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white px-4 py-2 rounded-xl font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm text-sm disabled:opacity-50"
              >
                {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                <span>{isSharing ? 'Skapar...' : 'Dela'}</span>
              </button>

              {finalStats.some((p: any) => p.history.length > 0) && (
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-4 py-2 rounded-xl font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all shadow-sm text-sm"
                >
                  {allExpanded ? <EyeOff size={18} /> : <Eye size={18} />}
                  <span className="hidden xs:inline">{allExpanded ? 'Dölj underlag' : 'Visa underlag'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {finalStats.map((player: any, index: number) => {
          const isExpanded = expandedPlayers.has(player.id);
          const hasHistory = player.history && player.history.length > 0;

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden"
            >
              <div 
                className={`p-4 flex items-center justify-between ${hasHistory ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''} transition-colors`}
                onClick={() => hasHistory && togglePlayer(player.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${
                    index === 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    index === 1 ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' :
                    index === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-zinc-50 text-zinc-400 dark:bg-zinc-950 dark:text-zinc-600'
                  }`}>
                    {index === 0 ? <Crown size={24} /> : index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg text-zinc-900 dark:text-white">{player.name}</span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {getSubtitle(player)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                      {player.totalPoints}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Poäng</div>
                  </div>
                  {hasHistory && (
                    <div className={`text-zinc-300 dark:text-zinc-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown size={20} />
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && hasHistory && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex flex-wrap gap-x-6 gap-y-3">
                        {player.history.map((h, i) => (
                          <div key={i} className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">
                              {new Date(h.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                {h.exerciseName}: <span className="text-indigo-600 dark:text-indigo-400">+{h.points}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {displayStats.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center text-zinc-400 mx-auto mb-6">
            <Trophy size={40} />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Ingen data än</h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            {selectedPeriodId === 'current' 
              ? 'Starta en period och genomför övningar för att se poängligan.' 
              : 'Inga poäng registrerade för denna period.'}
          </p>
        </div>
      )}

      {/* Create Period Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 mx-auto">
                <Plus size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Ny tävling</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-center">
                Skapa en ny tävling för att börja samla poäng i en separat lista.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Tävlingens namn</label>
                  <input
                    type="text"
                    value={newPeriodName}
                    onChange={(e) => setNewPeriodName(e.target.value)}
                    placeholder="T.ex. Vårcupen 2024"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                    autoFocus
                  />
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleCreateConfirm}
                    disabled={!newPeriodName.trim()}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
                  >
                    Skapa och aktivera
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Period Modal */}
      <AnimatePresence>
        {showRenameModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRenameModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Ändra namn</h3>
              
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Nytt namn</label>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                    autoFocus
                  />
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleRenameConfirm}
                    disabled={!renameValue.trim()}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
                  >
                    Spara namn
                  </button>
                  <button
                    onClick={() => setShowRenameModal(false)}
                    className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close Period Modal */}
      <AnimatePresence>
        {showCloseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCloseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 mx-auto">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Avsluta tävling?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-center">
                Detta arkiverar poängställningen för "{periods.find(p => p.id === selectedPeriodId)?.name}". Du kan fortfarande se resultatet senare, men inga nya övningar kan läggas till i denna tävling.
              </p>
              
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleCloseConfirm}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  Avsluta och arkivera
                </button>
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Avbryt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Period Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mb-6 mx-auto">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Ta bort period?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-center">
                Är du säker på att du vill ta bort denna period? Detta går inte att ångra. Övningar som tillhörde perioden kommer att finnas kvar men inte längre vara kopplade till en period.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeleteConfirm}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                >
                  Ja, ta bort perioden
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
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
