import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, ArrowLeft, Home as HomeIcon, Plus, UserPlus, X, Check, Sun, Moon, Timer as TimerIcon, Edit2, Gamepad2, Dice5, Target, Sword, Shield, Crown, Star, Heart, Zap, Flame, Ghost, Skull, Rocket, Car, Bike, Footprints, Dribbble, Music, Coffee, Users, LayoutDashboard, Calendar, Share2, Lock, Unlock, LogIn, LogOut, User as UserIcon, Mail, ShieldCheck, Cloud, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SquadPlayer, Exercise, Team, PRESET_COLORS, PointsConfig, Period, PeriodStandings, Lineup } from './types';
import { auth, signInWithGoogle, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { calculateLeaderboard } from './lib/leaderboardUtils';

const ICON_MAP: Record<string, any> = {
  Trophy, Gamepad2, Dice5, Target, Sword, Shield, Crown, Star, Heart, Zap, Flame, Ghost, Skull, Rocket, Car, Bike, Footprints, Dribbble, Music, Coffee
};
import GameSetup from './components/GameSetup';
import PlayerCard from './components/PlayerCard';
import GameList from './components/GameList';
import ColorPicker from './components/ColorPicker';
import Timer from './components/Timer';
import SquadManager from './components/SquadManager';
import Leaderboard from './components/Leaderboard';
import LineupBuilder from './components/LineupBuilder';

type View = 'home' | 'setup' | 'exercise' | 'squad' | 'leaderboard' | 'profile' | 'lineup';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sharedLeaderboardId, setSharedLeaderboardId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  });

  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [activeLineupId, setActiveLineupId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [currentPeriodId, setCurrentPeriodId] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('score_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);

  const [view, setView] = useState<View>('home');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishTargetPeriodId, setFinishTargetPeriodId] = useState<string | null>(null);
  const [isEditingActiveExercise, setIsEditingActiveExercise] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
  const lastSyncedAtRef = useRef<number>(0);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);

  // Lock to portrait mode if supported
  useEffect(() => {
    const lockPortrait = async () => {
      try {
        if (typeof window !== 'undefined' && window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
          // Note: Many browsers require fullscreen for this to work via JS
          // but for an installed PWA it might work differently in some environments.
          await (window.screen.orientation as any).lock('portrait');
        }
      } catch (e) {
        // Silently fail as many browsers don't support locking without fullscreen
        console.warn('Screen orientation lock not supported or failed:', e);
      }
    };
    lockPortrait();
  }, []);

  // Initial load from localStorage for guests
  useEffect(() => {
    if (isAuthReady && !user && !isInitialSyncDone) {
      const savedSquad = localStorage.getItem('football_squad');
      const savedExercises = localStorage.getItem('football_exercises');
      const savedLineups = localStorage.getItem('football_lineups');
      const savedActiveLineupId = localStorage.getItem('active_lineup_id');
      const savedPeriods = localStorage.getItem('football_periods');
      const savedCurrentPeriodId = localStorage.getItem('current_period_id');
      const savedActiveExerciseId = localStorage.getItem('active_exercise_id');

      if (savedSquad) setSquad(JSON.parse(savedSquad));
      if (savedExercises) setExercises(JSON.parse(savedExercises));
      
      if (savedLineups) {
        setLineups(JSON.parse(savedLineups));
      } else {
        // Migration: Check for old single lineup
        const oldLineup = localStorage.getItem('football_lineup');
        if (oldLineup) {
           const parsed = JSON.parse(oldLineup);
           setLineups([parsed]);
           setActiveLineupId(parsed.id);
        }
      }

      if (savedActiveLineupId) setActiveLineupId(savedActiveLineupId);
      if (savedPeriods) setPeriods(JSON.parse(savedPeriods));
      if (savedCurrentPeriodId) setCurrentPeriodId(savedCurrentPeriodId);
      if (savedActiveExerciseId) {
        setActiveExerciseId(savedActiveExerciseId);
        setView('exercise');
      }
      
      setIsInitialSyncDone(true);
    }
  }, [isAuthReady, user, isInitialSyncDone]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (newUser) => {
      // If the user actually changed (not just a refresh of the same user)
      if (newUser?.uid !== user?.uid) {
        // Clear local state immediately to avoid data leaking between accounts
        setSquad([]);
        setExercises([]);
        setLineups([]);
        setActiveLineupId(null);
        setPeriods([]);
        setCurrentPeriodId(crypto.randomUUID());
        setActiveExerciseId(null);
        setIsInitialSyncDone(false);
        setLastSyncedAt(0);
        
        // Clear localStorage as well
        localStorage.removeItem('football_squad');
        localStorage.removeItem('football_exercises');
        localStorage.removeItem('football_lineups');
        localStorage.removeItem('active_lineup_id');
        localStorage.removeItem('football_lineup');
        localStorage.removeItem('football_periods');
        localStorage.removeItem('current_period_id');
        localStorage.removeItem('active_exercise_id');
      }
      
      setUser(newUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [user]);

  // Initial cloud fetch
  useEffect(() => {
    if (user && isAuthReady && !isInitialSyncDone) {
      const fetchInitialData = async () => {
        try {
          const docRef = doc(db, 'users', user.uid, 'config', 'state');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSquad(data.squad || []);
            setExercises(data.exercises || []);
            setLineups(data.lineups || (data.lineup ? [data.lineup] : []));
            setActiveLineupId(data.activeLineupId || (data.lineup?.id) || null);
            setPeriods(data.periods || []);
            setCurrentPeriodId(data.currentPeriodId || (data.periods?.find((p: Period) => p.isActive)?.id) || null);
            const syncTime = data.updatedAt || Date.now();
            setLastSyncedAt(syncTime);
            lastSyncedAtRef.current = syncTime;
          } else {
            // No cloud data, we'll let the sync effect upload the local data
            // (This handles the case where a guest logs in for the first time)
            setLastSyncedAt(1); 
            lastSyncedAtRef.current = 1;
          }
          setIsInitialSyncDone(true);
        } catch (error) {
          console.error("Error fetching initial data:", error);
        }
      };
      fetchInitialData();
    }
  }, [user, isAuthReady, isInitialSyncDone]);

  // Sync to cloud when data changes
  useEffect(() => {
    if (user && isAuthReady && isInitialSyncDone) {
      // Optimistically update the sync timestamp to prevent onSnapshot from overwriting 
      // local changes while we wait for the debounce timeout.
      const now = Date.now();
      lastSyncedAtRef.current = now;

      const syncData = async () => {
        try {
          await setDoc(doc(db, 'users', user.uid, 'config', 'state'), {
            squad,
            exercises,
            lineups,
            activeLineupId,
            periods,
            currentPeriodId,
            updatedAt: now
          });
          setLastSyncedAt(now);
          
          // Also update localStorage as a backup
          localStorage.setItem('football_squad', JSON.stringify(squad));
          localStorage.setItem('football_exercises', JSON.stringify(exercises));
          localStorage.setItem('football_lineups', JSON.stringify(lineups));
          localStorage.setItem('active_lineup_id', activeLineupId || '');
          localStorage.setItem('football_periods', JSON.stringify(periods));
          localStorage.setItem('current_period_id', currentPeriodId || '');
        } catch (error) {
          console.error("Error syncing to cloud:", error);
        }
      };
      
      const timeout = setTimeout(syncData, 1000); // Reduced to 1s for better responsiveness
      return () => clearTimeout(timeout);
    }
  }, [squad, exercises, lineups, activeLineupId, periods, currentPeriodId, user, isAuthReady, isInitialSyncDone]);

  // Sync shared leaderboards globally
  useEffect(() => {
    if (user && isAuthReady && isInitialSyncDone) {
      const syncSharedLeaderboards = async () => {
        const sharedPeriods = periods.filter(p => p.shareId);
        if (sharedPeriods.length === 0) return;

        try {
          for (const period of sharedPeriods) {
            const stats = calculateLeaderboard(squad, exercises, period.id);
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
              coachUid: user.uid
            };
            await setDoc(doc(db, 'shared_leaderboards', period.shareId!), dataToUpdate, { merge: true });
          }
        } catch (error) {
          console.error("Error syncing shared leaderboards globally:", error);
        }
      };

      const timeoutId = setTimeout(syncSharedLeaderboards, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [squad, exercises, periods, user, isAuthReady, isInitialSyncDone]);

  // Update localStorage for guests
  useEffect(() => {
    if (!user && isAuthReady && isInitialSyncDone) {
      localStorage.setItem('football_squad', JSON.stringify(squad));
      localStorage.setItem('football_exercises', JSON.stringify(exercises));
      localStorage.setItem('football_lineups', JSON.stringify(lineups));
      localStorage.setItem('active_lineup_id', activeLineupId || '');
      localStorage.setItem('football_periods', JSON.stringify(periods));
      localStorage.setItem('current_period_id', currentPeriodId);
    }
  }, [squad, exercises, lineups, activeLineupId, periods, currentPeriodId, user, isAuthReady, isInitialSyncDone]);

  // Listen for cloud changes from other devices
  useEffect(() => {
    if (user && isAuthReady && isInitialSyncDone) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'config', 'state'), (docSnap) => {
        // Ignore local changes that haven't been fully committed to the server yet
        if (docSnap.metadata.hasPendingWrites) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.updatedAt > lastSyncedAtRef.current) {
            // Use functional updates to avoid dependencies on the state itself
            setSquad(current => JSON.stringify(data.squad) !== JSON.stringify(current) ? data.squad : current);
            setExercises(current => JSON.stringify(data.exercises) !== JSON.stringify(current) ? data.exercises : current);
            setLineups(current => JSON.stringify(data.lineups) !== JSON.stringify(current) ? (data.lineups || []) : current);
            setActiveLineupId(current => data.activeLineupId !== current ? data.activeLineupId : current);
            setPeriods(current => JSON.stringify(data.periods) !== JSON.stringify(current) ? data.periods : current);
            setCurrentPeriodId(current => data.currentPeriodId !== current ? data.currentPeriodId : current);
            
            lastSyncedAtRef.current = data.updatedAt;
            setLastSyncedAt(data.updatedAt);
          }
        }
      });
      return () => unsubscribe();
    }
  }, [user, isAuthReady, isInitialSyncDone]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('share');
      setSharedLeaderboardId(shareId);
      if (shareId) setView('leaderboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (sharedLeaderboardId) {
      setView('leaderboard');
    }
  }, [sharedLeaderboardId]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem('score_theme', theme);
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    if (activeExerciseId) {
      localStorage.setItem('active_exercise_id', activeExerciseId);
    } else {
      localStorage.removeItem('active_exercise_id');
    }
  }, [activeExerciseId]);

  const activeExercise = exercises.find(e => e.id === activeExerciseId);

  const handleStartExercise = (
    name: string, 
    icon: string, 
    teams: Omit<Team, 'score'>[], 
    sortByScore: boolean, 
    showTimer: boolean, 
    defaultTimerMinutes: number, 
    defaultTimerSeconds: number, 
    jokerPlayerIds: string[], 
    pointsConfig: PointsConfig,
    periodId?: string | null
  ) => {
    const now = Date.now();
    const newExercise: Exercise = {
      id: crypto.randomUUID(),
      name,
      icon,
      date: now,
      teams: teams.map(t => ({ ...t, playerIds: t.playerIds || [], score: 0 })),
      sortByScore,
      showTimer,
      defaultTimerMinutes,
      defaultTimerSeconds,
      jokerPlayerIds,
      pointsConfig,
      createdAt: now,
      updatedAt: now,
      periodId: periodId || null
    };
    setExercises(prev => [newExercise, ...prev]);
    setActiveExerciseId(newExercise.id);
    setView('exercise');
  };

  const handleSaveEditedExercise = (
    name: string, 
    icon: string, 
    teams: Omit<Team, 'score'>[], 
    sortByScore: boolean, 
    showTimer: boolean, 
    defaultTimerMinutes: number, 
    defaultTimerSeconds: number, 
    jokerPlayerIds: string[], 
    pointsConfig: PointsConfig,
    periodId?: string | null
  ) => {
    if (!activeExerciseId) return;
    
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      
      const updatedTeams = teams.map(t => {
        const existingTeam = e.teams.find(et => et.id === t.id);
        return {
          ...t,
          playerIds: t.playerIds || [],
          score: existingTeam ? existingTeam.score : 0
        };
      });

      return {
        ...e,
        name,
        icon,
        teams: updatedTeams,
        sortByScore,
        showTimer,
        defaultTimerMinutes,
        defaultTimerSeconds,
        jokerPlayerIds,
        pointsConfig,
        updatedAt: Date.now(),
        periodId: periodId || e.periodId
      };
    }));
    setIsEditingActiveExercise(false);
    setView('exercise');
  };

  const updateScore = (teamId: string, delta: number) => {
    if (!activeExerciseId || activeExercise?.isFinished) return;
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      return {
        ...e,
        updatedAt: Date.now(),
        teams: e.teams.map(t => 
          t.id === teamId ? { ...t, score: Math.max(0, t.score + delta) } : t
        ),
      };
    }));
  };

  const resetScores = () => {
    if (!activeExerciseId) return;
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      return {
        ...e,
        updatedAt: Date.now(),
        teams: e.teams.map(t => ({ ...t, score: 0 })),
      };
    }));
    setShowResetConfirm(false);
  };

  const deleteExercise = (id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
    if (activeExerciseId === id) {
      setActiveExerciseId(null);
      setView('home');
    }
  };

  const updateLineup = (newLineup: Lineup) => {
    setLineups(prev => prev.map(l => l.id === newLineup.id ? newLineup : l));
  };

  const handleSaveLineup = (newLineup: Lineup) => {
    setLineups(prev => {
      const exists = prev.find(l => l.id === newLineup.id);
      if (exists) {
        return prev.map(l => l.id === newLineup.id ? newLineup : l);
      }
      return [newLineup, ...prev];
    });
    setActiveLineupId(newLineup.id);
  };

  const handleDeleteLineup = (id: string) => {
    setLineups(prev => prev.filter(l => l.id !== id));
    if (activeLineupId === id) setActiveLineupId(null);
  };

  const handleCopyLineup = (id: string) => {
    const source = lineups.find(l => l.id === id);
    if (!source) return;
    const copied: Lineup = {
      ...source,
      id: crypto.randomUUID(),
      matchTitle: `${source.matchTitle} (kopia)`,
      date: Date.now()
    };
    setLineups(prev => [copied, ...prev]);
    setActiveLineupId(copied.id);
  };

  const selectExercise = (id: string) => {
    setActiveExerciseId(id);
    setView('exercise');
  };

  const handleCopyExercise = (id: string) => {
    const source = exercises.find(e => e.id === id);
    if (!source) return;

    const now = Date.now();
    const newExercise: Exercise = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (kopia)`,
      date: now,
      isFinished: false,
      teams: source.teams.map(t => ({ ...t, id: crypto.randomUUID(), playerIds: t.playerIds || [], score: 0 })),
      createdAt: now,
      updatedAt: now,
      periodId: currentPeriodId
    };

    setExercises(prev => [newExercise, ...prev]);
  };

  const handleEditExercise = (id: string) => {
    setActiveExerciseId(id);
    setIsEditingActiveExercise(true);
  };

  const handleRankClick = () => {
    if (!activeExerciseId) return;
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      return {
        ...e,
        updatedAt: Date.now(),
        teams: [...e.teams].sort((a, b) => b.score - a.score)
      };
    }));
  };

  const updateActiveExerciseDefaultTimer = (minutes: number, seconds: number) => {
    if (!activeExerciseId) return;
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      return {
        ...e,
        defaultTimerMinutes: minutes,
        defaultTimerSeconds: seconds,
        updatedAt: Date.now(),
      };
    }));
  };

  const toggleTimerVisibility = () => {
    if (!activeExerciseId) return;
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      return {
        ...e,
        showTimer: !e.showTimer,
        updatedAt: Date.now(),
      };
    }));
  };

  const finishExercise = () => {
    if (!activeExerciseId) return;
    
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      return {
        ...e,
        isFinished: true,
        updatedAt: Date.now(),
        periodId: finishTargetPeriodId || undefined
      };
    }));
    setShowFinishConfirm(false);
    setView('home');
    setActiveExerciseId(null);
  };

  const unlockExercise = () => {
    if (!activeExerciseId) return;
    setExercises(prev => prev.map(e => {
      if (e.id !== activeExerciseId) return e;
      return {
        ...e,
        isFinished: false,
        updatedAt: Date.now(),
      };
    }));
  };

  const handleClosePeriod = (name: string, standings: PeriodStandings[]) => {
    const now = Date.now();
    
    setPeriods(prev => prev.map(p => {
      if (p.id === currentPeriodId) {
        return {
          ...p,
          name: name || p.name,
          endDate: now,
          isActive: false,
          standings
        };
      }
      return p;
    }));
    
    setCurrentPeriodId(null);
  };

  const handleStartNewPeriod = () => {
    // This is now handled by a more specific function
  };

  const createNewPeriod = (name: string) => {
    const now = Date.now();
    const newId = crypto.randomUUID();
    const newPeriod: Period = {
      id: newId,
      name,
      startDate: now,
      standings: [],
      isActive: true
    };

    setPeriods(prev => {
      // Deactivate other periods
      const updated = prev.map(p => ({ ...p, isActive: false }));
      return [newPeriod, ...updated];
    });
    setCurrentPeriodId(newId);
  };

  const switchActivePeriod = (id: string) => {
    setPeriods(prev => prev.map(p => ({
      ...p,
      isActive: p.id === id
    })));
    setCurrentPeriodId(id);
  };

  const renamePeriod = (id: string, newName: string) => {
    setPeriods(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const updatePeriod = (id: string, updates: Partial<Period>) => {
    setPeriods(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleDeletePeriod = (id: string) => {
    setPeriods(prev => prev.filter(p => p.id !== id));
    // Also remove the periodId from exercises that were linked to this period
    setExercises(prev => prev.map(e => {
      if (e.periodId === id) {
        return { ...e, periodId: undefined };
      }
      return e;
    }));
  };

  const sortedScores = activeExercise ? Array.from(new Set(activeExercise.teams.map(t => t.score))).sort((a: number, b: number) => b - a) : [];

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      // Force account selection
      await signInWithGoogle(true);
    } catch (error) {
      console.error("Switch account failed", error);
    }
  };

  const clearSharedView = () => {
    setSharedLeaderboardId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.pushState({}, '', url);
    setView('home');
  };

  const activeLineup = lineups.find(l => l.id === activeLineupId) || null;

  return (
    <div className={`flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-100 transition-colors duration-500 ${view === 'exercise' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen pb-24'}`}>
      <header className={`bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-30 transition-colors duration-500 shrink-0 ${view === 'exercise' ? 'sticky top-0' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className={`flex items-center gap-3 cursor-pointer group min-w-0 ${view === 'lineup' ? 'hover:opacity-70' : ''}`}
            onClick={() => { 
              if (sharedLeaderboardId) {
                clearSharedView();
              } else if (view === 'exercise' || view === 'setup') {
                setView('home'); 
                setActiveExerciseId(null); 
                setIsEditingActiveExercise(false);
              } else if (view === 'lineup') {
                // No action on header click for lineup view
              }
            }}
          >
            {(view === 'exercise' || view === 'setup') && (
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none group-hover:scale-110 transition-transform shrink-0">
                <ArrowLeft size={20} strokeWidth={3} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-black text-xl tracking-tight dark:text-white truncate">
                {(() => {
                  if (view === 'exercise' && activeExercise) return activeExercise.name;
                  if (view === 'setup') return isEditingActiveExercise ? 'Redigera övning' : 'Skapa övning';
                  if (view === 'squad') return 'Truppen';
                  if (view === 'leaderboard') return 'Topplista';
                  if (view === 'profile') return 'Profil';
                  if (view === 'lineup') return 'Laguppställning';
                  if (sharedLeaderboardId) return 'Delad Topplista';
                  return 'Mina övningar';
                })()}
              </span>
              {(view === 'squad' || view === 'leaderboard') && (
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-[-2px]">
                  {view === 'squad' ? 'Hantera spelare' : 'Statistik & poäng'}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!sharedLeaderboardId && (
              <>
                {isAuthReady && view !== 'exercise' && (
                  user ? (
                    <button
                      onClick={() => setView('profile')}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl overflow-hidden border-2 transition-all ${view === 'profile' ? 'border-indigo-600 dark:border-indigo-400 scale-110' : 'border-zinc-200 dark:border-zinc-700 hover:border-indigo-400'}`}
                      title={`Profil: ${user.displayName}`}
                    >
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <UserIcon size={20} />
                        </div>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleLogin}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all border border-indigo-100 dark:border-indigo-900/30"
                      title="Logga in"
                    >
                      <LogIn size={20} />
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700"
                  title={theme === 'light' ? 'Mörkt läge' : 'Ljust läge'}
                >
                  {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
              </>
            )}
            {view === 'exercise' && activeExercise && (
              <>
                <button
                  onClick={toggleTimerVisibility}
                  className={`p-2 rounded-lg transition-all ${activeExercise.showTimer ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  title={activeExercise.showTimer ? "Dölj timer" : "Visa timer"}
                >
                  <TimerIcon size={20} />
                </button>
                <button
                  onClick={() => setIsEditingActiveExercise(true)}
                  className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                  title="Redigera övning"
                >
                  <Edit2 size={20} />
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                  title="Nollställ poäng"
                  disabled={activeExercise.isFinished}
                >
                  <RotateCcw size={20} />
                </button>
                {!activeExercise.isFinished && (
                  <button
                    onClick={() => {
                      setFinishTargetPeriodId(activeExercise.periodId || currentPeriodId);
                      setShowFinishConfirm(true);
                    }}
                    className="ml-2 bg-green-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none flex items-center gap-2"
                  >
                    <Check size={18} strokeWidth={3} />
                    <span className="hidden sm:inline">Avsluta</span>
                  </button>
                )}
                {activeExercise.isFinished && (
                  <button
                    onClick={unlockExercise}
                    className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                    title="Lås upp för redigering"
                  >
                    <Unlock size={20} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className={`flex-1 flex flex-col ${view === 'exercise' ? 'min-h-0 overflow-hidden' : ''}`}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            sharedLeaderboardId ? (
              <motion.div
                key="home-promo"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              >
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                  <Calendar size={40} />
                </div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Skapa egna övningar</h2>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mb-8 font-medium leading-relaxed">
                  Här kan du själv skapa egna övningar. Starta appen som ledare genom att gå till den här sidan.
                </p>
                <a
                  href={window.location.origin}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center gap-2"
                >
                  <Rocket size={20} />
                  <span>Kom igång här</span>
                </a>
              </motion.div>
            ) : (
              <GameList 
                key="home"
                exercises={exercises} 
                onSelectExercise={selectExercise} 
                onDeleteExercise={deleteExercise}
                onCopyExercise={handleCopyExercise}
                onEditExercise={handleEditExercise}
                onReorderExercises={setExercises}
                onNewExercise={() => setView('setup')}
              />
            )
          )}

          {view === 'setup' && (
            <GameSetup 
              key="setup" 
              onStartGame={isEditingActiveExercise ? handleSaveEditedExercise : handleStartExercise} 
              squad={squad} 
              currentPeriodId={currentPeriodId}
              initialGame={isEditingActiveExercise ? exercises.find(e => e.id === activeExerciseId) : undefined}
              onCancel={() => {
                setIsEditingActiveExercise(false);
                setView(activeExerciseId ? 'exercise' : 'home');
              }} 
            />
          )}

          {view === 'squad' && (
            sharedLeaderboardId ? (
              <motion.div
                key="squad-promo"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              >
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                  <Users size={40} />
                </div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Hantera din trupp</h2>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mb-8 font-medium leading-relaxed">
                  Här kan du lägga in din egen trupp om du själv vill använda appen. Gå till den här sidan för att komma igång.
                </p>
                <a
                  href={window.location.origin}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center gap-2"
                >
                  <Rocket size={20} />
                  <span>Starta din liga</span>
                </a>
              </motion.div>
            ) : (
              <SquadManager key="squad" squad={squad} onUpdateSquad={setSquad} />
            )
          )}

          {view === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto p-4 sm:p-8"
            >
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden">
                <div className="h-32 bg-indigo-600 relative">
                  <div className="absolute -bottom-12 left-8">
                    <div className="w-24 h-24 rounded-3xl border-4 border-white dark:border-zinc-900 bg-white dark:bg-zinc-800 overflow-hidden shadow-lg">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <UserIcon size={40} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="pt-16 pb-8 px-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                        {user?.displayName || 'Gäst'}
                      </h2>
                      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mt-1 font-bold text-sm">
                        <Mail size={14} />
                        <span>{user?.email}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleSwitchAccount}
                        className="flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
                      >
                        <RotateCcw size={18} />
                        <span>Byt konto</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-6 py-3 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/30"
                      >
                        <LogOut size={18} />
                        <span>Logga ut</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-3 mb-4 text-indigo-600 dark:text-indigo-400">
                        <Cloud size={20} />
                        <h3 className="font-black uppercase tracking-wider text-xs">Molnsynkronisering</h3>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Dina data sparas automatiskt i molnet och synkas mellan alla dina enheter där du är inloggad.
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-bold">
                        <ShieldCheck size={14} />
                        <span>Aktiv och säker</span>
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-3 mb-4 text-indigo-600 dark:text-indigo-400">
                        <LayoutDashboard size={20} />
                        <h3 className="font-black uppercase tracking-wider text-xs">Statistik</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-500">Truppen</span>
                          <span className="text-sm font-bold">{squad.length} spelare</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-500">Övningar</span>
                          <span className="text-sm font-bold">{exercises.length} st</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-500">Perioder</span>
                          <span className="text-sm font-bold">{periods.length} st</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!user && (
                <div className="mt-8 text-center">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Logga in för att spara din data</h3>
                  <button
                    onClick={handleLogin}
                    className="inline-flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
                  >
                    <LogIn size={20} />
                    <span>Logga in med Google</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'leaderboard' && (
            <Leaderboard 
              key="leaderboard" 
              squad={squad} 
              exercises={exercises} 
              periods={periods}
              currentPeriodId={currentPeriodId}
              onClosePeriod={handleClosePeriod}
              onStartNewPeriod={handleStartNewPeriod}
              onDeletePeriod={handleDeletePeriod}
              onCreatePeriod={createNewPeriod}
              onSwitchPeriod={switchActivePeriod}
              onRenamePeriod={renamePeriod}
              onUpdatePeriod={updatePeriod}
              sharedId={sharedLeaderboardId}
              userUid={user?.uid}
            />
          )}

          {view === 'lineup' && (
            <LineupBuilder 
              squad={squad} 
              lineup={activeLineup} 
              lineups={lineups}
              onUpdateLineup={updateLineup}
              onSaveLineup={handleSaveLineup}
              onDeleteLineup={handleDeleteLineup}
              onSelectLineup={setActiveLineupId}
              onCopyLineup={handleCopyLineup}
              onUpdateSquad={setSquad}
              user={user}
            />
          )}

          {view === 'exercise' && activeExercise && (
            <motion.div
              key="exercise"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto w-full h-full flex flex-col p-2 sm:p-4 overflow-hidden"
            >
              {activeExercise.showTimer && (
                <div className="mb-2 sm:mb-4 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-wrap gap-2">
                    {activeExercise.jokerPlayerIds && activeExercise.jokerPlayerIds.length > 0 && (
                      <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <Zap size={14} className="text-indigo-600 dark:text-indigo-400" fill="currentColor" />
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Jokrar:</span>
                        <div className="flex gap-1">
                          {activeExercise.jokerPlayerIds.map(id => {
                            const player = squad.find(p => p.id === id);
                            return (
                              <span key={id} className="text-[10px] font-black text-zinc-700 dark:text-zinc-300">
                                {player?.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="w-full sm:w-[calc(50%-0.25rem)] lg:w-[calc(33.33%-0.33rem)] xl:w-[calc(25%-0.375rem)]">
                    <Timer 
                      defaultMinutes={activeExercise.defaultTimerMinutes} 
                      defaultSeconds={activeExercise.defaultTimerSeconds} 
                      onSaveDefault={updateActiveExerciseDefaultTimer}
                    />
                  </div>
                </div>
              )}

              {!activeExercise.showTimer && activeExercise.jokerPlayerIds && activeExercise.jokerPlayerIds.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <Zap size={14} className="text-indigo-600 dark:text-indigo-400" fill="currentColor" />
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Jokrar:</span>
                    <div className="flex gap-1">
                      {activeExercise.jokerPlayerIds.map(id => {
                        const player = squad.find(p => p.id === id);
                        return (
                          <span key={id} className="text-[10px] font-black text-zinc-700 dark:text-zinc-300">
                            {player?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className={`flex-1 flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 min-h-0 ${activeExercise.teams.length > 5 ? 'overflow-y-auto' : 'overflow-hidden sm:overflow-y-auto'}`}>
                <AnimatePresence mode="popLayout">
                  {(activeExercise.sortByScore 
                    ? [...activeExercise.teams].sort((a, b) => b.score - a.score)
                    : activeExercise.teams
                  ).map((team) => (
                    <motion.div 
                      layout
                      key={team.id} 
                      className={`${activeExercise.teams.length > 5 ? 'h-24 shrink-0' : 'flex-1'} min-h-0 flex flex-col`}
                    >
                      <PlayerCard
                        team={team}
                        squad={squad}
                        rank={sortedScores.indexOf(team.score) + 1}
                        onUpdateScore={updateScore}
                        onRankClick={handleRankClick}
                        disabled={activeExercise.isFinished}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {view !== 'exercise' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-6 py-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button
              onClick={() => setView('home')}
              className={`flex flex-col items-center gap-1 transition-colors ${view === 'home' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Calendar size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Övningar</span>
            </button>
            <button
              onClick={() => setView('leaderboard')}
              className={`flex flex-col items-center gap-1 transition-colors ${view === 'leaderboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <LayoutDashboard size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Poängligan</span>
            </button>
            <button
              onClick={() => setView('squad')}
              className={`flex flex-col items-center gap-1 transition-colors ${view === 'squad' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Users size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Truppen</span>
            </button>
            <button
              onClick={() => setView('lineup')}
              className={`flex flex-col items-center gap-1 transition-colors ${view === 'lineup' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Layout size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Laguppställning</span>
            </button>
          </div>
        </nav>
      )}

      {/* Confirmation Modals */}
      <AnimatePresence>

        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Nollställ poäng?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                Detta kommer att sätta alla lags poäng till 0. Handlingen kan inte ångras.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={resetScores}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Ja, nollställ
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showFinishConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFinishConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 mb-6 mx-auto">
                <Trophy size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Avsluta övningen?</h3>
              
              <div className="mb-6">
                <label className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 text-center">
                  Klarmarkera mot tävling
                </label>
                <select
                  value={finishTargetPeriodId || ''}
                  onChange={(e) => setFinishTargetPeriodId(e.target.value || null)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">Ingen tävling (endast arkiv)</option>
                  {periods.filter(p => !p.endDate).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isActive ? '(Aktiv)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm text-center leading-relaxed">
                Detta kommer att kora vinnare och dela ut poäng till spelarna i den valda tävlingen.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={finishExercise}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none"
                >
                  Ja, avsluta och kora vinnare
                </button>
                <button
                  onClick={() => setShowFinishConfirm(false)}
                  className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Fortsätt övningen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Exercise Edit Overlay */}
      <AnimatePresence>
        {isEditingActiveExercise && activeExercise && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-[60] overflow-y-auto"
          >
            <div className="min-h-screen py-8">
              <GameSetup 
                initialGame={activeExercise} 
                onStartGame={handleSaveEditedExercise}
                onCancel={() => setIsEditingActiveExercise(false)}
                squad={squad}
                currentPeriodId={currentPeriodId}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
