import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, ArrowLeft, Home as HomeIcon, Plus, UserPlus, X, Check, Sun, Moon, Timer as TimerIcon, Edit2, Gamepad2, Dice5, Target, Sword, Shield, Crown, Star, Heart, Zap, Flame, Ghost, Skull, Rocket, Car, Bike, Footprints, Dribbble, Music, Coffee, Users, LayoutDashboard, Calendar, Share2, Lock, Unlock, LogIn, LogOut, User as UserIcon, Mail, ShieldCheck, Cloud, Layout, Upload, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SquadPlayer, Exercise, Team, PRESET_COLORS, PointsConfig, Period, PeriodStandings, Lineup, FormationVariant, TrainingSession } from './types';
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

import TeamPage from './components/TeamPage';
import TrainingManager from './components/TrainingManager';
import SessionEditor from './components/SessionEditor';
import TeamOverviewModal from './components/TeamOverviewModal';
import { CachedImage } from './components/CachedImage';

type View = 'training' | 'setup' | 'exercise' | 'squad' | 'leaderboard' | 'profile' | 'lineup' | 'teampage';

interface CoachData {
  squad: SquadPlayer[];
  exercises: Exercise[];
  sessions: TrainingSession[];
  lineups: Lineup[];
  activeLineupId: string | null;
  periods: Period[];
  currentPeriodId: string | null;
  activeExerciseId: string | null;
  teamUrl?: string;
  customFormations?: FormationVariant[];
  pinnedFormationIds?: string[];
}

const INITIAL_DATA: CoachData = {
  squad: [],
  exercises: [],
  sessions: [],
  lineups: [],
  activeLineupId: null,
  periods: [],
  currentPeriodId: null,
  activeExerciseId: null,
  teamUrl: '',
  customFormations: [],
  pinnedFormationIds: ['4-2-3-1', '4-4-2', '4-3-3']
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sharedLeaderboardId, setSharedLeaderboardId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  });

  const [data, setData] = useState<CoachData>(INITIAL_DATA);
  const { 
    squad = [], 
    exercises = [], 
    sessions = [], 
    lineups = [], 
    activeLineupId, 
    periods = [], 
    currentPeriodId, 
    activeExerciseId, 
    teamUrl = '', 
    customFormations = [], 
    pinnedFormationIds = ['4-2-3-1', '4-4-2', '4-3-3'] 
  } = (data || INITIAL_DATA);
  const [sessionActionCount, setSessionActionCount] = useState(0);
  const [linkToMomentId, setLinkToMomentId] = useState<string | null>(null);
  const [prefilledName, setPrefilledName] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('score_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    const shareId = params.get('share');
    
    // If sharing, priority is leaderboard (already handled by useEffect but setting here for initial sync too)
    if (shareId) return 'leaderboard';
    
    if (v === 'squad' || v === 'training' || v === 'leaderboard' || v === 'profile' || v === 'lineup' || v === 'teampage') {
      return v as View;
    }
    return 'training';
  });
  const [trainingTab, setTrainingTab] = useState<'planned' | 'completed' | 'exercises'>('planned');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<'plan' | 'live'>('plan');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishTargetPeriodId, setFinishTargetPeriodId] = useState<string | null>(null);
  const [isEditingActiveExercise, setIsEditingActiveExercise] = useState(false);
  const [editReturnView, setEditReturnView] = useState<View | null>(null);
  const [showTeamOverview, setShowTeamOverview] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
  const lastSyncedAtRef = useRef<number>(0);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(7));
  const syncUserIdRef = useRef<string | null>(null);
  const lastCloudDataRef = useRef<CoachData | null>(null);
  const notifiedMomentsRef = useRef<Set<string>>(new Set());

  // Notification Scheduler for Training Moments
  useEffect(() => {
    const checkNotifications = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const now = Date.now();
      
      sessions.forEach(session => {
        if (session.isStarted && session.actualStartTime && !session.isCompleted) {
          let cumulativeMinutes = 0;
          session.moments.forEach((moment) => {
            // Combine session date with start time string (HH:mm) to get absolute planned start
            const [h, m] = (session.startTime || "00:00").split(':').map(Number);
            const momentPlannedStartBase = new Date(session.date);
            momentPlannedStartBase.setHours(h, m, 0, 0);
            
            const momentDuration = typeof moment.duration === 'string' ? parseInt(moment.duration, 10) : moment.duration;
            const scheduledStartTime = momentPlannedStartBase.getTime() + (cumulativeMinutes * 60000);
            
            // User wants notice exactly 1 minute BEFORE start
            const notificationTargetTime = scheduledStartTime - 60000;
            const notificationKey = `${session.id}-${moment.id}-${session.actualStartTime}`;
            
            // Trigger if:
            // 1. Current time is at or past notification target time
            // 2. Notification target time was NOT before we manually started the session
            // 3. We haven't notified for this specific session run yet
            if (now >= notificationTargetTime && 
                notificationTargetTime >= session.actualStartTime! && 
                !notifiedMomentsRef.current.has(notificationKey)) {
              
              // Safety window: don't notify if the moment's start time was more than 10 minutes ago
              if (now < scheduledStartTime + 10 * 60000 && document.visibilityState !== 'visible') {
                new Notification(`Om 1 minut: ${moment.name || 'Nästa moment'}`, {
                  body: `Träning: ${session.title}\nLängd: ${momentDuration} min`,
                  icon: '/favicon.ico',
                  tag: `moment-${moment.id}`,
                  silent: false
                });
              }
              notifiedMomentsRef.current.add(notificationKey);
            }
            
            cumulativeMinutes += (momentDuration || 0);
          });
        }
      });
    };

    const intervalId = window.setInterval(checkNotifications, 5000); // Check every 5 seconds
    return () => window.clearInterval(intervalId);
  }, [sessions]);

  // Initial load from localStorage for guests
  useEffect(() => {
    if (isAuthReady && !user && !isInitialSyncDone) {
      console.log("App: Loading guest data from localStorage");
      const savedSquad = localStorage.getItem('football_squad');
      const savedExercises = localStorage.getItem('football_exercises');
      const savedSessions = localStorage.getItem('football_sessions');
      const savedLineups = localStorage.getItem('football_lineups');
      const savedActiveLineupId = localStorage.getItem('active_lineup_id');
      const savedPeriods = localStorage.getItem('football_periods');
      const savedCurrentPeriodId = localStorage.getItem('current_period_id');
      const savedActiveExerciseId = localStorage.getItem('active_exercise_id');
      const savedTeamUrl = localStorage.getItem('team_url');
      const savedCustomFormations = localStorage.getItem('custom_formations');

      const newState: CoachData = {
        squad: savedSquad ? JSON.parse(savedSquad) : [],
        exercises: savedExercises ? JSON.parse(savedExercises) : [],
        sessions: savedSessions ? JSON.parse(savedSessions) : [],
        lineups: savedLineups ? JSON.parse(savedLineups) : [],
        activeLineupId: savedActiveLineupId || null,
        periods: savedPeriods ? JSON.parse(savedPeriods) : [],
        currentPeriodId: savedCurrentPeriodId || null,
        activeExerciseId: savedActiveExerciseId || null,
        teamUrl: savedTeamUrl || '',
        customFormations: savedCustomFormations ? JSON.parse(savedCustomFormations) : [],
        pinnedFormationIds: localStorage.getItem('pinned_formations') ? JSON.parse(localStorage.getItem('pinned_formations')!) : ['4-2-3-1', '4-4-2', '4-3-3']
      };

      setData(newState);
      
      // For guests, we are effectively "done" with initial sync immediately
      setIsInitialSyncDone(true);
    }
  }, [isAuthReady, user, isInitialSyncDone]);

  // Sync to localStorage IMMEDIATELY for persistence
  useEffect(() => {
    if (isAuthReady && isInitialSyncDone) {
      localStorage.setItem('football_squad', JSON.stringify(squad));
      localStorage.setItem('football_exercises', JSON.stringify(exercises));
      localStorage.setItem('football_sessions', JSON.stringify(sessions));
      localStorage.setItem('football_lineups', JSON.stringify(lineups));
      localStorage.setItem('active_lineup_id', activeLineupId || '');
      localStorage.setItem('football_periods', JSON.stringify(periods));
      localStorage.setItem('current_period_id', currentPeriodId || '');
      localStorage.setItem('active_exercise_id', activeExerciseId || '');
      localStorage.setItem('team_url', teamUrl || '');
      localStorage.setItem('custom_formations', JSON.stringify(customFormations));
      localStorage.setItem('pinned_formations', JSON.stringify(pinnedFormationIds));
      localStorage.setItem('last_local_sync_at', Date.now().toString());
    }
  }, [squad, exercises, lineups, activeLineupId, periods, currentPeriodId, activeExerciseId, isAuthReady, isInitialSyncDone]);

  // Clear data on user change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (newUser) => {
      if (newUser?.uid !== user?.uid) {
        console.log("App: User changed, resetting states and action count");
        setData(INITIAL_DATA);
        setSessionActionCount(0);
        setIsInitialSyncDone(false);
        setLastSyncedAt(0);
        lastSyncedAtRef.current = 0;
        syncUserIdRef.current = null;
        lastCloudDataRef.current = null;
      }
      setUser(newUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Unified Cloud Data Hook
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionActionCount > 0 || isSyncing) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionActionCount, isSyncing]);

  useEffect(() => {
    if (user && isAuthReady) {
      console.log("App: Starting primary cloud listener for", user.email);
      const docRef = doc(db, 'users', user.uid, 'config', 'state');
      
      let isFirstPull = true;

      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (!snapshot.exists()) {
          console.log("App: Cloud is empty.");
          if (isFirstPull) {
            // Migration: Check if we have local data to "claim" for this new cloud account
            const savedSquad = localStorage.getItem('football_squad');
            if (savedSquad && JSON.parse(savedSquad).length > 0) {
              console.log("App: Found local data, migrating to empty cloud");
              const savedExercises = localStorage.getItem('football_exercises');
              const savedSessions = localStorage.getItem('football_sessions');
              const savedLineups = localStorage.getItem('football_lineups');
              const savedActiveLineupId = localStorage.getItem('active_lineup_id');
              const savedPeriods = localStorage.getItem('football_periods');
              const savedCurrentPeriodId = localStorage.getItem('current_period_id');
              const savedActiveExerciseId = localStorage.getItem('active_exercise_id');
              const savedTeamUrl = localStorage.getItem('team_url');

              const newState: CoachData = {
                squad: JSON.parse(savedSquad),
                exercises: savedExercises ? JSON.parse(savedExercises) : [],
                sessions: savedSessions ? JSON.parse(savedSessions) : [],
                lineups: savedLineups ? JSON.parse(savedLineups) : [],
                activeLineupId: savedActiveLineupId || null,
                periods: savedPeriods ? JSON.parse(savedPeriods) : [],
                currentPeriodId: savedCurrentPeriodId || null,
                activeExerciseId: savedActiveExerciseId || null,
                teamUrl: savedTeamUrl || '',
                customFormations: localStorage.getItem('custom_formations') ? JSON.parse(localStorage.getItem('custom_formations')!) : [],
                pinnedFormationIds: localStorage.getItem('pinned_formations') ? JSON.parse(localStorage.getItem('pinned_formations')!) : ['4-2-3-1', '4-4-2', '4-3-3']
              };
              setData(newState);
              setSessionActionCount(1); // Force a push of this migrated data
            }
            syncUserIdRef.current = user.uid;
            setIsInitialSyncDone(true);
            isFirstPull = false;
          }
          return;
        }

        const cloudData = snapshot.data();
        
        // Skip if we caused this update
        if (cloudData.lastUpdatedBy === sessionIdRef.current) {
          console.log("App: Cloud confirmed our push.");
          if (isFirstPull) {
            setIsInitialSyncDone(true);
            isFirstPull = false;
          }
          return;
        }

        // Apply remote data
        console.log("App: Applying remote updates from cloud");
        
        const newState: CoachData = {
          squad: cloudData.squad || [],
          exercises: cloudData.exercises || [],
          sessions: cloudData.sessions || [],
          lineups: cloudData.lineups || [],
          activeLineupId: cloudData.activeLineupId || null,
          periods: cloudData.periods || [],
          currentPeriodId: cloudData.currentPeriodId || null,
          activeExerciseId: cloudData.activeExerciseId || null,
          teamUrl: cloudData.teamUrl || '',
          customFormations: cloudData.customFormations || [],
          pinnedFormationIds: cloudData.pinnedFormationIds || ['4-2-3-1', '4-4-2', '4-3-3']
        };

        setData(newState);
        lastCloudDataRef.current = newState;
        setSessionActionCount(0); // Reset after applying cloud truth
        
        const syncTime = cloudData.updatedAt || Date.now();
        setLastSyncedAt(syncTime);
        lastSyncedAtRef.current = syncTime;
        syncUserIdRef.current = user.uid;

        if (isFirstPull) {
          setIsInitialSyncDone(true);
          isFirstPull = false;
        }
      }, (error) => {
        console.error("App: Cloud sync error:", error);
      });

      return () => unsubscribe();
    }
  }, [user?.uid, isAuthReady]);

  // Push Local Actions to Cloud
  useEffect(() => {
    if (user && isAuthReady && isInitialSyncDone && sessionActionCount > 0) {
      // Security: verify current data actually belongs to this user
      if (syncUserIdRef.current !== user.uid) return;
      
      const syncData = async () => {
        if (syncUserIdRef.current !== user.uid) return;
        
        const currentState = { squad, exercises, sessions, lineups, activeLineupId, periods, currentPeriodId, activeExerciseId, teamUrl, customFormations, pinnedFormationIds };
        
        // Skip if current state matches what we last saw from cloud
        if (lastCloudDataRef.current) {
          if (JSON.stringify(currentState) === JSON.stringify(lastCloudDataRef.current)) {
            console.log("App: Local state matches cloud, skipping push.");
            setSessionActionCount(0);
            return;
          }
        }
        
        console.log("App: Syncing local actions (" + sessionActionCount + ") to cloud...");
        setIsSyncing(true);
        const now = Date.now();
        try {
          await setDoc(doc(db, 'users', user.uid, 'config', 'state'), {
            ...currentState,
            updatedAt: now,
            lastUpdatedBy: sessionIdRef.current
          }, { merge: false }); // Use merge: false to ensure we push the full truth
          
          setLastSyncedAt(now);
          lastSyncedAtRef.current = now;
          lastCloudDataRef.current = currentState;
          setSessionActionCount(0); // Reset after successful push
        } catch (error) {
          console.error("App: Cloud push failed", error);
        } finally {
          setIsSyncing(false);
        }
      };
      
      const timeout = setTimeout(syncData, 1000); // 1s sync debounce (reduced from 3s)
      return () => clearTimeout(timeout);
    }
  }, [squad, exercises, sessions, lineups, activeLineupId, periods, currentPeriodId, activeExerciseId, teamUrl, customFormations, pinnedFormationIds, sessionActionCount, user?.uid, isAuthReady, isInitialSyncDone]);

  // Sync shared leaderboards globally
  useEffect(() => {
    if (user && isAuthReady && isInitialSyncDone) {
      const syncSharedLeaderboards = async () => {
        const sharedPeriods = periods.filter(p => p.shareId);
        if (sharedPeriods.length === 0) return;

        // Gather all guest players from all sessions to include them in leaderboard if they have points
        const allGuestPlayers = sessions.reduce((acc, s) => {
          const guests = s.guestPlayers || [];
          guests.forEach(g => {
            if (!acc.find(pg => pg.id === g.id)) {
              acc.push(g);
            }
          });
          return acc;
        }, [] as SquadPlayer[]);

        const combinedPlayers = [...squad, ...allGuestPlayers];

        try {
          for (const period of sharedPeriods) {
            const stats = calculateLeaderboard(squad, exercises, period.id, periods);
            const dataToUpdate = {
              id: period.shareId,
              name: period.name,
              standings: stats.map((p: any) => ({
                playerId: p.id,
                playerName: p.name,
                imageUrl: p.photoUrl || null,
                points: p.totalPoints,
                history: p.history || []
              })),
              updatedAt: Date.now(),
              startDate: period.startDate || null,
              endDate: period.endDate || null,
              coachUid: user.uid,
              activeExerciseId: activeExerciseId
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

  // REMOVED: Redundant secondary listener

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
    periodId?: string | null,
    sessionId?: string | null
  ) => {
    const now = Date.now();
    const resolvedSessionId = (sessionId && sessionId !== 'active') ? sessionId : (activeSessionId || undefined);
    
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
      periodId: periodId || null,
      sessionId: resolvedSessionId
    };
    
    setData(prev => ({
      ...prev,
      exercises: [newExercise, ...prev.exercises],
      activeLineupId: activeLineupId,
      activeExerciseId: newExercise.id,
      sessions: (linkToMomentId && activeSessionId) 
        ? prev.sessions.map(s => s.id === activeSessionId 
            ? { ...s, moments: s.moments.map(m => m.id === linkToMomentId ? { ...m, exerciseId: newExercise.id } : m), updatedAt: Date.now() } 
            : s)
        : prev.sessions
    }));
    setSessionActionCount(prev => prev + 1);
    
    setLinkToMomentId(null);
    setPrefilledName(null);

    // If it has a session ID, we return to the training view (session editor)
    if (resolvedSessionId) {
      setActiveSessionId(resolvedSessionId);
      setView('training');
    } else {
      setActiveSessionId(null);
      setView('exercise');
    }
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
    periodId?: string | null,
    sessionId?: string | null
  ) => {
    if (!activeExerciseId) return;
    
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== prev.activeExerciseId) return e;
        
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
          periodId: periodId || e.periodId,
          sessionId: sessionId || (activeSessionId || e.sessionId)
        };
      }),
      sessions: linkToMomentId && activeSessionId 
        ? prev.sessions.map(s => s.id === activeSessionId 
            ? { ...s, moments: s.moments.map(m => m.id === linkToMomentId ? { ...m, exerciseId: (prev.activeExerciseId || '') } : m), updatedAt: Date.now() } 
            : s)
        : prev.sessions
    }));
    setSessionActionCount(prev => prev + 1);
    setIsEditingActiveExercise(false);
    
    // Determine where to go back
    const isEditingViewedExercise = activeExerciseId === (exercises.find(e => e.id === activeExerciseId)?.id);

    if (editReturnView) {
      setView(editReturnView);
      setEditReturnView(null);
    } else if (isEditingViewedExercise) {
      setView('exercise');
    } else if (linkToMomentId || activeSessionId) {
      setView('training');
    } else {
      setView('exercise');
    }

    // Clean up common setup states
    setLinkToMomentId(null);
    setPrefilledName(null);
  };

  const updateTeamColor = (teamId: string, color: string) => {
    if (!activeExerciseId) return;
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          updatedAt: Date.now(),
          teams: e.teams.map(t => 
            t.id === teamId ? { ...t, color } : t
          ),
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const updateScore = (teamId: string, delta: number) => {
    if (!activeExerciseId || activeExercise?.isFinished) return;
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          updatedAt: Date.now(),
          teams: e.teams.map(t => 
            t.id === teamId ? { ...t, score: Math.max(0, t.score + delta) } : t
          ),
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const resetScores = () => {
    if (!activeExerciseId) return;
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          updatedAt: Date.now(),
          teams: e.teams.map(t => ({ ...t, score: 0 })),
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
    setShowResetConfirm(false);
  };

  const deleteExercise = (id: string) => {
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.filter(e => e.id !== id),
      activeExerciseId: prev.activeExerciseId === id ? null : prev.activeExerciseId
    }));
    setSessionActionCount(prev => prev + 1);
    if (activeExerciseId === id) {
      setView('training');
    }
  };

  const updateLineup = (newLineup: Lineup) => {
    // We always set sessionActionCount to 1 to trigger a sync when this is called,
    // as it's debounced from the LineupBuilder side only when actual changes happen.
    setData(prev => ({
      ...prev,
      lineups: prev.lineups.map(l => l.id === newLineup.id ? newLineup : l)
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const handleSaveLineup = (newLineup: Lineup) => {
    setData(prev => {
      const exists = prev.lineups.find(l => l.id === newLineup.id);
      const newLineups = exists 
        ? prev.lineups.map(l => l.id === newLineup.id ? newLineup : l)
        : [newLineup, ...prev.lineups];
      
      return {
        ...prev,
        lineups: newLineups,
        activeLineupId: newLineup.id
      };
    });
    setSessionActionCount(prev => prev + 1);
  };

  const handleDeleteLineup = (id: string) => {
    setData(prev => ({
      ...prev,
      lineups: prev.lineups.filter(l => l.id !== id),
      activeLineupId: prev.activeLineupId === id ? null : prev.activeLineupId
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const handleCopyLineup = (id: string) => {
    setData(prev => {
      const source = prev.lineups.find(l => l.id === id);
      if (!source) return prev;
      const copied: Lineup = {
        ...source,
        id: crypto.randomUUID(),
        matchTitle: `${source.matchTitle} (kopia)`,
        date: Date.now()
      };
      return {
        ...prev,
        lineups: [copied, ...prev.lineups],
        activeLineupId: copied.id
      };
    });
    setSessionActionCount(prev => prev + 1);
  };

  const handleReorderExercises = (newExercises: Exercise[]) => {
    setData(prev => ({ ...prev, exercises: newExercises }));
    setSessionActionCount(prev => prev + 1);
  };

  const onNewSession = () => {
    const newSession: TrainingSession = {
      id: crypto.randomUUID(),
      title: '',
      date: Date.now(),
      startTime: '18:00',
      moments: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setData(prev => ({
      ...prev,
      sessions: [newSession, ...(prev.sessions || [])]
    }));
    setActiveSessionId(newSession.id);
    setSessionActionCount(prev => prev + 1);
  };

  const onUpdateSession = (updatedSession: TrainingSession) => {
    setData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === updatedSession.id ? updatedSession : s)
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const onDeleteSession = (id: string) => {
    setData(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== id)
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const handleCopySession = (id: string) => {
    setData(prev => {
      const source = prev.sessions.find(s => s.id === id);
      if (!source) return prev;

      const newExercises: Exercise[] = [];
      const newMoments = source.moments.map(m => {
        if (m.exerciseId) {
          const sourceExercise = prev.exercises.find(e => e.id === m.exerciseId);
          if (sourceExercise) {
            const newExId = crypto.randomUUID();
            const newEx: Exercise = {
              ...sourceExercise,
              id: newExId,
              name: sourceExercise.name,
              date: Date.now(),
              isFinished: false,
              sessionId: source.id, // Will be updated to newSession.id later if needed
              teams: sourceExercise.teams.map(t => ({ ...t, id: crypto.randomUUID(), score: 0, playerIds: [] })),
              jokerPlayerIds: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              periodId: currentPeriodId // Assign to current active period
            };
            newExercises.push(newEx);
            return { ...m, id: crypto.randomUUID(), exerciseId: newExId };
          }
        }
        return { ...m, id: crypto.randomUUID() };
      });

      const newSession: TrainingSession = {
        ...source,
        id: crypto.randomUUID(),
        title: source.title ? `${source.title} (kopia)` : 'Träning (kopia)',
        date: Date.now(),
        isCompleted: false, // Always start as planned
        moments: newMoments,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Ensure copied exercises refer to the NEW session ID
      const finalizedExercises = newExercises.map(e => ({ ...e, sessionId: newSession.id }));

      return {
        ...prev,
        sessions: [newSession, ...prev.sessions],
        exercises: [...finalizedExercises, ...prev.exercises]
      };
    });
    setSessionActionCount(prev => prev + 1);
  };

  const selectExercise = (id: string) => {
    setData(prev => ({ ...prev, activeExerciseId: id }));
    setSessionActionCount(prev => prev + 1);
    setView('exercise');
  };

  const handleCopyExercise = (id: string) => {
    setData(prev => {
      const source = prev.exercises.find(e => e.id === id);
      if (!source) return prev;

      const now = Date.now();
      const newExercise: Exercise = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} (kopia)`,
        date: now,
        isFinished: false,
        teams: source.teams.map(t => ({ ...t, id: crypto.randomUUID(), playerIds: [], score: 0 })),
        jokerPlayerIds: [],
        createdAt: now,
        updatedAt: now,
        periodId: currentPeriodId
      };

      return {
        ...prev,
        exercises: [newExercise, ...prev.exercises]
      };
    });
    setSessionActionCount(prev => prev + 1);
  };

  const handleEditExercise = (id: string) => {
    setData(prev => ({ ...prev, activeExerciseId: id }));
    setSessionActionCount(prev => prev + 1);
    setEditReturnView(view);
    setIsEditingActiveExercise(true);
    setView('setup');
  };

  const handleReorderLineups = (reordered: Lineup[]) => {
    setData(prev => ({ ...prev, lineups: reordered }));
    setSessionActionCount(prev => prev + 1);
  };

  const handleRankClick = () => {
    if (!activeExerciseId) return;
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          updatedAt: Date.now(),
          teams: [...e.teams].sort((a, b) => b.score - a.score)
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const handleUpdateTeamUrl = (url: string) => {
    setData(prev => ({ ...prev, teamUrl: url }));
    setSessionActionCount(prev => prev + 1);
  };

  const updateActiveExerciseDefaultTimer = (minutes: number, seconds: number) => {
    if (!activeExerciseId) return;
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          defaultTimerMinutes: minutes,
          defaultTimerSeconds: seconds,
          updatedAt: Date.now(),
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const toggleTimerVisibility = () => {
    if (!activeExerciseId) return;
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          showTimer: !e.showTimer,
          updatedAt: Date.now(),
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const finishExercise = () => {
    if (!activeExerciseId) return;
    
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          isFinished: true,
          updatedAt: Date.now(),
          periodId: finishTargetPeriodId || undefined
        };
      }),
      activeExerciseId: null
    }));
    setSessionActionCount(prev => prev + 1);
    setShowFinishConfirm(false);
    setView('training');
  };

  const unlockExercise = () => {
    if (!activeExerciseId) return;
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== activeExerciseId) return e;
        return {
          ...e,
          isFinished: false,
          updatedAt: Date.now(),
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const handleClosePeriod = (name: string, standings: PeriodStandings[]) => {
    const now = Date.now();
    
    setData(prev => ({
      ...prev,
      periods: prev.periods.map(p => {
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
      }),
      currentPeriodId: null
    }));
    setSessionActionCount(prev => prev + 1);
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

    setData(prev => {
      const updatedPeriods = prev.periods.map(p => ({ ...p, isActive: false }));
      return {
        ...prev,
        periods: [newPeriod, ...updatedPeriods],
        currentPeriodId: newId
      };
    });
    setSessionActionCount(prev => prev + 1);
  };

  const switchActivePeriod = (id: string) => {
    setData(prev => ({
      ...prev,
      periods: prev.periods.map(p => ({
        ...p,
        isActive: p.id === id
      })),
      currentPeriodId: id
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const renamePeriod = (id: string, newName: string) => {
    setData(prev => ({
      ...prev,
      periods: prev.periods.map(p => p.id === id ? { ...p, name: newName } : p)
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const updatePeriod = (id: string, updates: Partial<Period>) => {
    setData(prev => ({
      ...prev,
      periods: prev.periods.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const handleDeletePeriod = (id: string) => {
    setData(prev => ({
      ...prev,
      periods: prev.periods.filter(p => p.id !== id),
      exercises: prev.exercises.map(e => {
        if (e.periodId === id) {
          return { ...e, periodId: undefined };
        }
        return e;
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const movePlayer = (exerciseId: string, playerId: string, targetTeamId: string) => {
    setData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => {
        if (e.id !== exerciseId) return e;
        
        // Remove player from all teams and joker list first
        const updatedTeams = e.teams.map(t => ({
          ...t,
          playerIds: (t.playerIds || []).filter(id => id !== playerId)
        }));
        const updatedJokerIds = (e.jokerPlayerIds || []).filter(id => id !== playerId);
        
        // If target is "joker", add to joker list
        if (targetTeamId === 'joker') {
          return {
            ...e,
            teams: updatedTeams,
            jokerPlayerIds: [...updatedJokerIds, playerId],
            updatedAt: Date.now()
          };
        }

        // If target is "none", just keep removed from everything (moves to unassigned pool)
        if (targetTeamId === 'none') {
          return {
            ...e,
            teams: updatedTeams,
            jokerPlayerIds: updatedJokerIds,
            updatedAt: Date.now()
          };
        }
        
        // Add to target team
        return {
          ...e,
          teams: updatedTeams.map(t => 
            t.id === targetTeamId ? { ...t, playerIds: [...t.playerIds, playerId] } : t
          ),
          jokerPlayerIds: updatedJokerIds,
          updatedAt: Date.now()
        };
      })
    }));
    setSessionActionCount(prev => prev + 1);
  };

  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);

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

  const handleManualPush = async () => {
    if (!user) return;
    setIsSyncing(true);
    const now = Date.now();
    const currentState = { squad, exercises, sessions, lineups, activeLineupId, periods, currentPeriodId, activeExerciseId, teamUrl, customFormations, pinnedFormationIds };
    try {
      await setDoc(doc(db, 'users', user.uid, 'config', 'state'), {
        ...currentState,
        updatedAt: now,
        lastUpdatedBy: sessionIdRef.current
      }, { merge: false });
      setLastSyncedAt(now);
      lastSyncedAtRef.current = now;
      syncUserIdRef.current = user.uid;
      setSessionActionCount(0); // Reset after manual push
      localStorage.setItem('last_local_sync_at', now.toString());
      console.log("App: Manual push successful");
    } catch (error: any) {
      console.error("App: Manual push failed", error);
      let errorMsg = "Synkronisering misslyckades.";
      if (error?.code === 'permission-denied') errorMsg += " Behörighet saknas.";
      else if (error?.code === 'resource-exhausted') errorMsg += " Kvoten (quota) är överskriden.";
      else errorMsg += " Kontrollera din internetanslutning.";
      alert(errorMsg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualPull = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const docSnap = await getDoc(doc(db, 'users', user.uid, 'config', 'state'));
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        const newState: CoachData = {
          squad: cloudData.squad || [],
          exercises: cloudData.exercises || [],
          sessions: cloudData.sessions || [],
          lineups: cloudData.lineups || [],
          activeLineupId: cloudData.activeLineupId || null,
          periods: cloudData.periods || [],
          currentPeriodId: cloudData.currentPeriodId || null,
          activeExerciseId: cloudData.activeExerciseId || null,
          teamUrl: cloudData.teamUrl || '',
          customFormations: cloudData.customFormations || [],
          pinnedFormationIds: cloudData.pinnedFormationIds || ['4-2-3-1', '4-4-2', '4-3-3']
        };
        setData(newState);
        syncUserIdRef.current = user.uid;
        setSessionActionCount(0); // Reset after manual pull
        setLastSyncedAt(cloudData.updatedAt || Date.now());
        lastSyncedAtRef.current = cloudData.updatedAt || Date.now();
        console.log("App: Manual pull successful");
      } else {
        alert("Ingen data hittades i molnet.");
      }
    } catch (error) {
      console.error("App: Manual pull failed", error);
    } finally {
      setIsSyncing(false);
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
    setView('training');
  };

  const handleUpdateSquad = (newSquad: SquadPlayer[]) => {
    setData(prev => {
      if (JSON.stringify(prev.squad) === JSON.stringify(newSquad)) {
        return prev;
      }
      return { 
        ...prev, 
        squad: newSquad
      };
    });
    setSessionActionCount(prev => prev + 1);
  };

  const activeLineup = lineups.find(l => l.id === activeLineupId) || null;

  if (isAuthReady && user && !isInitialSyncDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-8 text-center animate-pulse">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
          <Cloud size={32} />
        </div>
        <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Synkroniserar...</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Hämtar din trupp från molnet</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-100 transition-colors duration-500 ${(view === 'exercise' || view === 'teampage') ? 'h-[100dvh] overflow-hidden' : 'min-h-screen pb-24'}`}>
      {view !== 'lineup' && (
        <header className={`bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-30 transition-colors duration-500 shrink-0 ${view === 'exercise' ? 'sticky top-0' : ''}`}>
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
              className={`flex items-center gap-3 cursor-pointer group min-w-0 ${view === 'lineup' ? 'hover:opacity-70' : ''}`}
              onClick={() => { 
                if (sharedLeaderboardId) {
                  clearSharedView();
                } else if (view === 'setup' && isEditingActiveExercise) {
                  // If editing an exercise, go back to where we started editing
                  if (editReturnView) {
                    setView(editReturnView);
                    setEditReturnView(null);
                  } else {
                    setView(activeExerciseId ? 'exercise' : 'training');
                  }
                  setIsEditingActiveExercise(false);
                } else if (view === 'exercise' || view === 'setup') {
                  setView('training'); 
                  setData(prev => ({ ...prev, activeExerciseId: null }));
                  setSessionActionCount(prev => prev + 1);
                  setIsEditingActiveExercise(false);
                  // If we have an active session, let it stay active
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
                    if (view === 'setup') return isEditingActiveExercise ? 'Redigera tävlingsmoment' : 'Skapa tävlingsmoment';
                    if (view === 'training') return 'Planering';
                    if (view === 'squad') return 'Truppen';
                    if (view === 'leaderboard') return 'Topplista';
                    if (view === 'profile') return 'Profil';
                    if (view === 'lineup') return 'Laguppställning';
                    if (view === 'teampage') return 'Lagsidan';
                    if (sharedLeaderboardId) return 'Delad Topplista';
                    return 'Träning';
                  })()}
                </span>
                {(view === 'squad' || view === 'leaderboard' || view === 'teampage' || view === 'training') && (
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-[-2px]">
                    {view === 'squad' ? 'Hantera spelare' : view === 'leaderboard' ? 'Statistik & poäng' : view === 'training' ? 'Träningspass & Tävlingsmoment' : 'Webb & Kalender'}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {(isSyncing || (user && sessionActionCount > 0)) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                    isSyncing 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800 animate-pulse' 
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                  }`}
                >
                  {isSyncing ? (
                    <>
                      <Cloud size={14} className="animate-bounce" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">Synkar</span>
                    </>
                  ) : (
                    <button 
                      onClick={handleManualPush}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:scale-95 transition-all"
                      title="Spara ändringar till molnet nu"
                    >
                      <TimerIcon size={14} className="animate-spin-slow" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">Väntar...</span>
                      <div className="w-px h-3 bg-amber-200 dark:bg-amber-800 mx-1" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none underline decoration-amber-400">Spara nu</span>
                    </button>
                  )}
                </motion.div>
              )}
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
                  {view === 'exercise' ? (
                    <button
                      type="button"
                      onClick={() => setShowTeamOverview(true)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all border border-indigo-100 dark:border-indigo-900/30"
                      title="Visa lagöversikt"
                    >
                      <Users size={20} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700"
                      title={theme === 'light' ? 'Mörkt läge' : 'Ljust läge'}
                    >
                      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                  )}
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
                    onClick={() => {
                      setEditReturnView('exercise');
                      setIsEditingActiveExercise(true);
                      setView('setup');
                    }}
                    className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                    title="Redigera tävlingsmoment"
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
      )}

      <main className={`flex-1 flex flex-col ${view === 'exercise' ? 'min-h-0 overflow-hidden' : ''}`}>
        <AnimatePresence mode="wait">
          {view === 'training' && (
            sharedLeaderboardId ? (
              <motion.div
                key="training-promo"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              >
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                  <Dribbble size={40} />
                </div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Planera din träning</h2>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mb-8 font-medium leading-relaxed">
                  Här kan du planera dina träningar och skapa tävlingsmoment. Starta appen som ledare genom att gå till den här sidan.
                </p>
                <button
                  onClick={() => {
                    setSharedLeaderboardId(null);
                    const url = new URL(window.location.origin);
                    url.searchParams.set('view', 'squad');
                    window.history.pushState({}, '', url);
                    setView('squad');
                  }}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center gap-2"
                >
                  <Rocket size={20} />
                  <span>Kom igång här</span>
                </button>
              </motion.div>
            ) : (
              <>
                <TrainingManager 
                  exercises={exercises} 
                  sessions={sessions}
                  squad={squad}
                  activeTab={trainingTab}
                  onTabChange={setTrainingTab}
                  onSelectExercise={(id) => {
                    setData(prev => ({ ...prev, activeExerciseId: id }));
                    setView('exercise');
                  }} 
                  onDeleteExercise={(id) => {
                    setData(prev => ({
                      ...prev,
                      exercises: prev.exercises.filter(e => e.id !== id)
                    }));
                    setSessionActionCount(prev => prev + 1);
                  }}
                  onCopyExercise={(id) => {
                    const ex = exercises.find(e => e.id === id);
                    if (ex) {
                      const newEx = {
                        ...ex,
                        id: Math.random().toString(36).substring(7),
                        name: `${ex.name} (kopia)`,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        isFinished: false
                      };
                      setData(prev => ({
                        ...prev,
                        exercises: [newEx, ...prev.exercises]
                      }));
                      setSessionActionCount(prev => prev + 1);
                    }
                  }}
                  onEditExercise={(id) => {
                    setData(prev => ({ ...prev, activeExerciseId: id }));
                    setEditReturnView(activeExerciseId === id ? 'exercise' : 'training');
                    setIsEditingActiveExercise(true);
                    setView('setup');
                  }}
                  onReorderExercises={(reordered) => {
                    setData(prev => ({ ...prev, exercises: reordered }));
                    setSessionActionCount(prev => prev + 1);
                  }}
                  onNewExercise={() => setView('setup')}
                  onNewSession={onNewSession}
                  onSelectSession={id => setActiveSessionId(id)}
                  onDeleteSession={onDeleteSession}
                  onCopySession={handleCopySession}
                  onUpdateSession={onUpdateSession}
                  onMovePlayer={movePlayer}
                  onReorderSessions={(reordered) => {
                    setData(prev => ({ ...prev, sessions: reordered }));
                    setSessionActionCount(prev => prev + 1);
                  }}
                />
              </>
            )
          )}

          {view === 'setup' && (() => {
            const exerciseBeingEdited = isEditingActiveExercise ? exercises.find(e => e.id === activeExerciseId) : undefined;
            const effectiveSessionId = activeSessionId || exerciseBeingEdited?.sessionId;
            const currentSession = effectiveSessionId ? sessions.find(s => s.id === effectiveSessionId) : undefined;
            
            // Unique key ensures the component remounts and re-initializes its state
            const setupKey = isEditingActiveExercise 
              ? `edit-${activeExerciseId}` 
              : `new-${effectiveSessionId || 'general'}-${prefilledName || 'unnamed'}`;

            return (
              <GameSetup 
                key={setupKey} 
                onStartGame={isEditingActiveExercise ? handleSaveEditedExercise : handleStartExercise} 
                squad={squad} 
                guestPlayers={currentSession?.guestPlayers}
                sessionAttendance={currentSession?.attendance}
                activeSessionId={effectiveSessionId}
                sessions={sessions}
                currentPeriodId={currentPeriodId}
                initialGame={isEditingActiveExercise 
                  ? exerciseBeingEdited 
                  : (prefilledName ? { name: prefilledName, teams: [], icon: 'Dribbble' } as any : undefined)
                }
                onCancel={() => {
                  if (editReturnView) {
                    setView(editReturnView);
                    setEditReturnView(null);
                  } else if (activeExerciseId) {
                    setView('exercise');
                  } else {
                    setView('training');
                  }
                  setIsEditingActiveExercise(false);
                  setPrefilledName(null);
                }} 
              />
            );
          })()}

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
                <button
                  onClick={() => {
                    setSharedLeaderboardId(null);
                    const url = new URL(window.location.origin);
                    url.searchParams.set('view', 'squad');
                    window.history.pushState({}, '', url);
                    setView('squad');
                  }}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center gap-2"
                >
                  <Rocket size={20} />
                  <span>Lägg in din egen trupp</span>
                </button>
              </motion.div>
            ) : (
              <SquadManager key="squad" squad={squad} onUpdateSquad={handleUpdateSquad} />
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
                        <CachedImage src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
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
                      <button
                        onClick={handleManualPull}
                        className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 px-6 py-3 rounded-2xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-all border border-indigo-100 dark:border-indigo-950/30"
                      >
                        <Cloud size={18} />
                        <span>Hämta från molnet</span>
                      </button>
                      <button
                        onClick={handleManualPush}
                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                      >
                        <Upload size={18} />
                        <span>Spara till molnet</span>
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
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-bold">
                          <ShieldCheck size={14} />
                          <span>Aktiv och säker</span>
                        </div>
                        {isSyncing && (
                          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold animate-pulse">
                            <RotateCcw size={14} className="animate-spin" />
                            <span>Synkroniserar...</span>
                          </div>
                        )}
                        <div className="pt-2 flex flex-col gap-2">
                          <button
                            onClick={handleManualPull}
                            disabled={isSyncing}
                            className="w-full text-left px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between group"
                          >
                            <span>Hämta från molnet</span>
                            <Cloud size={14} className="group-hover:translate-y-[-1px] transition-transform" />
                          </button>
                          <button
                            onClick={handleManualPush}
                            disabled={isSyncing}
                            className="w-full text-left px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between group"
                          >
                            <span>Skicka till molnet</span>
                            <Cloud size={14} className="group-hover:translate-y-[-1px] transition-transform" />
                          </button>
                        </div>
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
                          <span className="text-sm text-zinc-500">Tävlingsmoment</span>
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

          {view === 'teampage' && (
            <motion.div
              key="teampage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0 w-full"
            >
              <TeamPage 
                initialUrl={teamUrl}
                onUpdateUrl={handleUpdateTeamUrl}
              />
              {/* Spacer for bottom nav when not in standalone full-height mode */}
              <div className="h-20 shrink-0" />
            </motion.div>
          )}

          {view === 'lineup' && (
            <LineupBuilder 
              squad={squad} 
              lineup={activeLineup} 
              lineups={lineups}
              onUpdateLineup={updateLineup}
              onSaveLineup={handleSaveLineup}
              onDeleteLineup={handleDeleteLineup}
              onSelectLineup={(id) => {
                setData(prev => ({ ...prev, activeLineupId: id }));
                setSessionActionCount(prev => prev + 1);
              }}
              onCopyLineup={handleCopyLineup}
              onReorderLineups={handleReorderLineups}
              onUpdateSquad={handleUpdateSquad}
              customFormations={customFormations}
              pinnedFormationIds={pinnedFormationIds}
              onTogglePinFormation={(id) => {
                setData(prev => {
                  const pinned = prev.pinnedFormationIds || ['4-2-3-1', '4-4-2', '4-3-3'];
                  const isPinned = pinned.includes(id);
                  const newPinned = isPinned 
                    ? pinned.filter(pid => pid !== id)
                    : [...pinned, id];
                  return { ...prev, pinnedFormationIds: newPinned };
                });
                setSessionActionCount(prev => prev + 1);
              }}
              onSaveCustomFormation={(formation) => {
                setData(prev => ({
                  ...prev,
                  customFormations: [...(prev.customFormations || []), formation]
                }));
                setSessionActionCount(prev => prev + 1);
              }}
              onDeleteCustomFormation={(id) => {
                setData(prev => ({
                  ...prev,
                  customFormations: (prev.customFormations || []).filter(f => f.id !== id)
                }));
                setSessionActionCount(prev => prev + 1);
              }}
              user={user}
            />
          )}

          {view === 'exercise' && (
            activeExercise ? (
              <motion.div
                key="exercise"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-7xl mx-auto w-full h-full flex flex-col p-2 sm:p-4 overflow-hidden"
              >
              {activeExercise.showTimer && (
                <div className="mb-4 sm:mb-6 shrink-0 flex flex-col items-center gap-4">
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeExercise.jokerPlayerIds && activeExercise.jokerPlayerIds.length > 0 && (
                      <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
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
                  <div className="w-full max-w-sm">
                    <Timer 
                      defaultMinutes={activeExercise.defaultTimerMinutes} 
                      defaultSeconds={activeExercise.defaultTimerSeconds} 
                      onSaveDefault={updateActiveExerciseDefaultTimer}
                    />
                  </div>
                </div>
              )}

              {!activeExercise.showTimer && activeExercise.jokerPlayerIds && activeExercise.jokerPlayerIds.length > 0 && (
                <div className="mb-6 flex justify-center flex-wrap gap-2">
                  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                    <Zap size={14} className="text-indigo-600 dark:text-indigo-400" fill="currentColor" />
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Jokrar:</span>
                    <div className="flex gap-1">
                      {activeExercise.jokerPlayerIds.map(id => {
                        const exerciseSession = activeExercise.sessionId ? sessions.find(s => s.id === activeExercise.sessionId) : null;
                        const guestsForExercise = exerciseSession?.guestPlayers || [];
                        const combinedExerciseSquad = [...squad, ...guestsForExercise];
                        const player = combinedExerciseSquad.find(p => p.id === id);
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

              <div className={`flex-1 flex flex-col gap-2 sm:gap-3 min-h-0 w-full max-w-2xl mx-auto ${activeExercise.teams.length > 5 ? 'overflow-y-auto' : 'overflow-hidden sm:overflow-y-auto'}`}>
                <AnimatePresence mode="popLayout">
                  {(activeExercise.sortByScore 
                    ? [...activeExercise.teams].sort((a, b) => b.score - a.score)
                    : activeExercise.teams
                  ).filter((team, index, self) => 
                    index === self.findIndex((t) => t.id === team.id)
                  ).map((team) => {
                    const exerciseSession = activeExercise.sessionId ? sessions.find(s => s.id === activeExercise.sessionId) : null;
                    const guestsForExercise = exerciseSession?.guestPlayers || [];
                    const combinedExerciseSquad = [...squad, ...guestsForExercise];

                    return (
                      <motion.div 
                        layout
                        key={team.id} 
                        className={`${activeExercise.teams.length > 5 ? 'h-24 shrink-0' : 'flex-1'} min-h-0 flex flex-col`}
                      >
                        <PlayerCard
                          team={team}
                          squad={combinedExerciseSquad}
                          rank={sortedScores.indexOf(team.score) + 1}
                          onUpdateScore={updateScore}
                          onUpdateColor={updateTeamColor}
                          onRankClick={handleRankClick}
                          disabled={activeExercise.isFinished}
                          exerciseId={activeExercise.id}
                          onMovePlayer={movePlayer}
                          draggedPlayerId={draggedPlayerId}
                          isAnyPlayerDragging={!!draggedPlayerId}
                          onDragStart={(pid) => setDraggedPlayerId(pid)}
                          onDragEnd={() => setDraggedPlayerId(null)}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-zinc-950">
                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center text-zinc-400 mb-6">
                  <Trophy size={40} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Tävlingsmomentet hittades inte</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-xs font-medium">
                  Detta kan bero på att momentet har tagits bort eller att du navigerat fel.
                </p>
                <button
                  onClick={() => setView('training')}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
                >
                  Gå tillbaka till träning
                </button>
              </div>
            )
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {view !== 'exercise' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-6 py-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-1">
            <button
              onClick={() => setView('training')}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors ${view === 'training' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Dribbble size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Träning</span>
            </button>
            <button
              onClick={() => setView('leaderboard')}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors ${view === 'leaderboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <LayoutDashboard size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Poängliga</span>
            </button>
            <button
              onClick={() => setView('squad')}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors ${view === 'squad' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Users size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Truppen</span>
            </button>
            <button
              onClick={() => setView('lineup')}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors ${view === 'lineup' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Layout size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Laguppst.</span>
            </button>
            <button
              onClick={() => setView('teampage')}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors ${view === 'teampage' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Globe size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Lagsida</span>
            </button>
          </div>
        </nav>
      )}

      <AnimatePresence>
        {showTeamOverview && activeExercise && (
          <TeamOverviewModal
            exercise={activeExercise}
            squad={[...squad, ...(sessions.find(s => s.id === activeExercise.sessionId)?.guestPlayers || [])]}
            attendingIds={sessions.find(s => s.id === activeExercise.sessionId)?.attendance}
            onMovePlayer={movePlayer}
            onClose={() => setShowTeamOverview(false)}
          />
        )}
      </AnimatePresence>

      {/* Sessions & Overlays */}
      <AnimatePresence>
        {activeSessionId && sessions.find(s => s.id === activeSessionId) && view !== 'exercise' && view !== 'setup' && (
          <SessionEditor
            session={sessions.find(s => s.id === activeSessionId)!}
            exercises={exercises}
            squad={squad}
            onUpdate={onUpdateSession}
            initialMode={sessionMode}
            onModeChange={setSessionMode}
            onMovePlayer={movePlayer}
            onClose={() => {
              setActiveSessionId(null);
              setLinkToMomentId(null);
            }}
            onCreateExercise={(name, momentId) => {
              setLinkToMomentId(momentId);
              setPrefilledName(name || 'Nytt tävlingsmoment');
              setIsEditingActiveExercise(false);
              setView('setup');
              setSessionActionCount(prev => prev + 1);
              return ""; 
            }}
            onSelectExercise={(id) => {
              setData(prev => ({ ...prev, activeExerciseId: id }));
              setView('exercise');
              setSessionActionCount(prev => prev + 1);
              // We DON'T call setActiveSessionId(null) here because we want to come back to it
            }}
            onEditExercise={(id) => {
              setData(prev => ({ ...prev, activeExerciseId: id }));
              setIsEditingActiveExercise(true);
              setView('setup');
              setSessionActionCount(prev => prev + 1);
            }}
            onDeleteExercise={deleteExercise}
          />
        )}
      </AnimatePresence>

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
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Avsluta tävlingsmomentet?</h3>
              
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
                  {Array.from(new Map<string, Period>(periods.filter(p => !p.endDate).map(p => [p.id, p])).values()).map((p: Period) => (
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
                  Fortsätt tävlingsmomentet
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
