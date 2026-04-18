import React, { useState } from 'react';
import { Plus, Minus, Trash2, Play, UserPlus, Trophy, Gamepad2, Dice5, Target, Sword, Shield, Crown, Star, Heart, Zap, Flame, Ghost, Skull, Rocket, Car, Bike, Footprints, Dribbble, Music, Coffee, AlertCircle, X, Check, Calendar, Users, Medal, ChevronDown, ChevronUp, Save, ClipboardList, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SquadPlayer, PRESET_COLORS, GAME_ICONS, Exercise, Team, PointsConfig } from '../types';
import ColorPicker from './ColorPicker';

const ICON_MAP: Record<string, any> = {
  Trophy, Gamepad2, Dice5, Target, Sword, Shield, Crown, Star, Heart, Zap, Flame, Ghost, Skull, Rocket, Car, Bike, Footprints, Dribbble, Music, Coffee
};

interface GameSetupProps {
  onStartGame: (
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
  ) => void;
  initialGame?: Exercise;
  onCancel?: () => void;
  squad: SquadPlayer[];
  currentPeriodId: string | null;
  key?: React.Key;
}

const VEST_COLORS = [
  '#84CC16', // Lime
  '#0EA5E9', // Sky
  '#1E3A8A', // Navy
  '#71717A', // Zinc
  '#F97316', // Orange
];

export default function GameSetup({ onStartGame, initialGame, onCancel, squad, currentPeriodId }: GameSetupProps) {
  const [gameName, setGameName] = useState(initialGame?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(initialGame?.icon || 'Dribbble');
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [sortByScore, setSortByScore] = useState(initialGame?.sortByScore ?? false);
  const [showTimer, setShowTimer] = useState(initialGame?.showTimer ?? true);
  const [defaultMinutes, setDefaultMinutes] = useState(initialGame?.defaultTimerMinutes ?? 4);
  const [defaultSeconds, setDefaultSeconds] = useState(initialGame?.defaultTimerSeconds ?? 0);
  const [jokerPlayerIds, setJokerPlayerIds] = useState<string[]>(initialGame?.jokerPlayerIds || []);
  const [pointsConfig, setPointsConfig] = useState<PointsConfig>(initialGame?.pointsConfig || { first: 1, second: 0, third: 0 });
  const [showJokers, setShowJokers] = useState(false);
  const [showAttendanceInput, setShowAttendanceInput] = useState(false);
  const [attendanceText, setAttendanceText] = useState('');
  
  const [teams, setTeams] = useState<Omit<Team, 'score'>[]>(
    initialGame?.teams.map(({ score, ...t }) => t) || [
      { id: crypto.randomUUID(), name: 'Lag 1', color: VEST_COLORS[0], playerIds: [] },
      { id: crypto.randomUUID(), name: 'Lag 2', color: VEST_COLORS[1], playerIds: [] },
    ]
  );

  const adjustDefaultTime = (type: 'min' | 'sec', amount: number) => {
    if (type === 'min') {
      const next = Math.max(0, Math.min(99, defaultMinutes + amount));
      setDefaultMinutes(next);
    } else {
      let nextSec = defaultSeconds + amount;
      let nextMin = defaultMinutes;
      
      if (nextSec >= 60) {
        nextMin = Math.min(99, nextMin + 1);
        nextSec = 0;
      } else if (nextSec < 0) {
        if (nextMin > 0) {
          nextMin -= 1;
          nextSec = 50;
        } else {
          nextSec = 0;
        }
      }
      
      setDefaultMinutes(nextMin);
      setDefaultSeconds(nextSec);
    }
  };

  const addTeam = () => {
    const nextColor = teams.length < VEST_COLORS.length 
      ? VEST_COLORS[teams.length] 
      : PRESET_COLORS[teams.length % PRESET_COLORS.length];
    setTeams([...teams, { id: crypto.randomUUID(), name: '', color: nextColor, playerIds: [] }]);
  };

  const removeTeam = (id: string) => {
    if (teams.length <= 1) return;
    setTeams(teams.filter(t => t.id !== id));
  };

  const updateTeam = (id: string, updates: Partial<Omit<Team, 'score'>>) => {
    setTeams(teams.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const setTeamCount = (count: number, isIndividual = false) => {
    if (count < 1) return;
    const newTeams: Omit<Team, 'score'>[] = [];
    const navyBlue = "#1e3a8a"; 
    
    if (isIndividual) {
      squad.forEach((player) => {
        newTeams.push({ 
          id: crypto.randomUUID(), 
          name: '', 
          color: navyBlue, 
          playerIds: [player.id] 
        });
      });
    } else {
      for (let i = 0; i < count; i++) {
        const nextColor = i < VEST_COLORS.length 
          ? VEST_COLORS[i] 
          : PRESET_COLORS[i % PRESET_COLORS.length];
        newTeams.push({ id: crypto.randomUUID(), name: '', color: nextColor, playerIds: [] });
      }
    }
    setTeams(newTeams);
  };

  const togglePlayerInTeam = (teamId: string, playerId: string) => {
    // Remove from jokers if it was there
    setJokerPlayerIds(prev => prev.filter(id => id !== playerId));
    
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        const exists = t.playerIds.includes(playerId);
        return {
          ...t,
          playerIds: exists 
            ? t.playerIds.filter(id => id !== playerId)
            : [...t.playerIds, playerId]
        };
      }
      // Remove player from other teams if they are being added here
      if (!t.playerIds.includes(playerId)) return t;
      return {
        ...t,
        playerIds: t.playerIds.filter(id => id !== playerId)
      };
    }));
  };

  const toggleJoker = (playerId: string) => {
    // Remove from any team if it was there
    setTeams(teams.map(t => ({
      ...t,
      playerIds: t.playerIds.filter(id => id !== playerId)
    })));

    setJokerPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const generateTeamsFromAttendance = () => {
    if (!attendanceText.trim()) return;

    // 1. Parse names from text (split by newlines, commas, etc.)
    const inputNames = attendanceText
      .split(/[\n,;]/)
      .map(name => name.trim().toLowerCase())
      .filter(name => name.length > 0);

    // 2. Match with squad
    const attendingPlayers: SquadPlayer[] = [];
    
    squad.forEach(player => {
      const playerNameLower = player.name.toLowerCase();
      // Check for exact match or if the input name is part of the player name
      const isAttending = inputNames.some(inputName => {
        if (playerNameLower === inputName) return true;
        // Handle cases like "First Last" vs "First"
        if (playerNameLower.includes(inputName) && inputName.length > 2) return true;
        return false;
      });

      if (isAttending) {
        attendingPlayers.push(player);
      }
    });

    if (attendingPlayers.length === 0) {
      alert("Hittade inga spelare som matchade namnen i listan. Kontrollera stavningen.");
      return;
    }

    // 3. Group players by position to distribute them evenly
    const playersByPosition: Record<string, string[]> = {};
    attendingPlayers.forEach(p => {
      const pos = p.position || 'Odefinierad';
      if (!playersByPosition[pos]) playersByPosition[pos] = [];
      playersByPosition[pos].push(p.id);
    });

    // 4. Distribute into current number of teams
    const teamCount = teams.length;
    const newTeams = teams.map(t => ({ ...t, playerIds: [] as string[] }));
    
    // We use a global counter to ensure teams get an equal number of players 
    // while also spreading out positions
    let globalPlayerIndex = 0;

    // Process each position group
    Object.keys(playersByPosition).sort().forEach(pos => {
      const playerIds = playersByPosition[pos];
      // Shuffle players within this position
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      
      shuffled.forEach(id => {
        const teamIndex = globalPlayerIndex % teamCount;
        newTeams[teamIndex].playerIds.push(id);
        globalPlayerIndex++;
      });
    });

    setTeams(newTeams);
    setShowAttendanceInput(false);
    setAttendanceText('');
    
    // Clear jokers as they might not be attending or should be in teams now
    setJokerPlayerIds([]);
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGame(
      gameName || 'Ny övning', 
      selectedIcon, 
      teams, 
      sortByScore, 
      showTimer, 
      defaultMinutes, 
      defaultSeconds, 
      jokerPlayerIds, 
      pointsConfig,
      initialGame ? initialGame.periodId : currentPeriodId
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto p-4 sm:p-6"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-zinc-100 dark:border-zinc-800 transition-colors duration-300 pb-32">
        <form id="game-setup-form" onSubmit={handleStart} className="space-y-8">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Välj ikon</label>
                <button 
                  type="button"
                  onClick={() => setShowAllIcons(!showAllIcons)}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline"
                >
                  {showAllIcons ? 'Visa färre' : 'Visa alla'}
                </button>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {GAME_ICONS.filter(icon => showAllIcons || icon === selectedIcon).map((iconName) => {
                  const Icon = ICON_MAP[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIcon(iconName)}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                        selectedIcon === iconName 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-110' 
                          : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Icon size={20} />
                    </button>
                  );
                })}
                {!showAllIcons && (
                  <button
                    type="button"
                    onClick={() => setShowAllIcons(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-950 text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Övningens namn</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="T.ex. Smålagsspel, Avslut eller Teknikbana"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-lg font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-900 dark:text-white text-sm">Automatisk sortering av lag</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider leading-tight">SORTERING DIREKT UTIFRÅN POÄNG</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSortByScore(!sortByScore)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                    sortByScore ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <motion.div
                    animate={{ x: sortByScore ? 22 : 2 }}
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-900 dark:text-white text-sm">Timer</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">Visa i övningen</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimer(!showTimer)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                    showTimer ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <motion.div
                    animate={{ x: showTimer ? 22 : 2 }}
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showTimer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex flex-col mb-4">
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">Standardtid</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">Tid per omgång</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Minuter</span>
                        <div className="flex items-center gap-4">
                          <button type="button" onClick={() => adjustDefaultTime('min', -1)} className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                            <Minus size={18} />
                          </button>
                          <span className="text-2xl font-black min-w-[2ch] text-center dark:text-white">{defaultMinutes}</span>
                          <button type="button" onClick={() => adjustDefaultTime('min', 1)} className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Sekunder</span>
                        <div className="flex items-center gap-4">
                          <button type="button" onClick={() => adjustDefaultTime('sec', -10)} className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                            <Minus size={18} />
                          </button>
                          <span className="text-2xl font-black min-w-[2ch] text-center dark:text-white">{defaultSeconds.toString().padStart(2, '0')}</span>
                          <button type="button" onClick={() => adjustDefaultTime('sec', 10)} className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Save size={18} />
                <span>Spara inställningar</span>
              </button>
            </div>
          </div>


          <div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 mb-8">
              <div className="flex flex-col mb-6">
                <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Poäng till poängligan</label>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Hur många poäng får 1:an, 2:an och 3:an?</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                    <Trophy size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">1:a</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPointsConfig(prev => ({ ...prev, first: Math.max(0, prev.first - 1) }))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                      <Minus size={14} />
                    </button>
                    <span className="text-xl font-black min-w-[1.5ch] text-center dark:text-white">{pointsConfig.first}</span>
                    <button type="button" onClick={() => setPointsConfig(prev => ({ ...prev, first: prev.first + 1 }))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
                    <Medal size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">2:a</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPointsConfig(prev => ({ ...prev, second: Math.max(0, prev.second - 1) }))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                      <Minus size={14} />
                    </button>
                    <span className="text-xl font-black min-w-[1.5ch] text-center dark:text-white">{pointsConfig.second}</span>
                    <button type="button" onClick={() => setPointsConfig(prev => ({ ...prev, second: prev.second + 1 }))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Medal size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">3:e</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPointsConfig(prev => ({ ...prev, third: Math.max(0, prev.third - 1) }))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                      <Minus size={14} />
                    </button>
                    <span className="text-xl font-black min-w-[1.5ch] text-center dark:text-white">{pointsConfig.third}</span>
                    <button type="button" onClick={() => setPointsConfig(prev => ({ ...prev, third: prev.third + 1 }))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-90 transition-all">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col shrink-0">
                  <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Antal lag</label>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Välj snabbt eller lägg till manuellt</span>
                </div>
                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTeamCount(num)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                        teams.length === num 
                          ? 'bg-indigo-600 border-indigo-600 text-white' 
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 h-8">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Eget:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      placeholder="#"
                      className="w-8 bg-transparent border-none focus:ring-0 outline-none text-xs font-bold text-zinc-900 dark:text-white p-0 text-center"
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > 0) setTeamCount(val);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeamCount(squad.length, true)}
                    disabled={squad.length === 0}
                    className="px-3 h-8 rounded-lg text-[10px] font-bold transition-all border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-300 uppercase disabled:opacity-50"
                  >
                    Ett lag per spelare
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowAttendanceInput(!showAttendanceInput)}
                className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                    <ClipboardList size={20} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-zinc-900 dark:text-white text-sm">Skapa lag från närvarolista</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">KLISTRA IN NAMN OCH FÖRDELA AUTOMATISKT</span>
                  </div>
                </div>
                <div className="text-zinc-400">
                  {showAttendanceInput ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence>
                {showAttendanceInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Klistra in namnen på de spelare som är på plats (t.ex. från kallelsen). 
                        Appen matchar namnen mot truppen och fördelar dem slumpmässigt i de {teams.length} lag du valt.
                      </p>
                      <textarea
                        value={attendanceText}
                        onChange={(e) => setAttendanceText(e.target.value)}
                        placeholder="Klistra in namn här (separera med ny rad eller kommatecken)..."
                        className="w-full h-32 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium resize-none"
                      />
                      <button
                        type="button"
                        onClick={generateTeamsFromAttendance}
                        disabled={!attendanceText.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Wand2 size={18} />
                        <span>Skapa lag automatiskt</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowJokers(!showJokers)}
                className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <div className="flex flex-col text-left">
                  <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider cursor-pointer">Jokrar</label>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Spelare som är med i alla lag och alltid får poäng</span>
                </div>
                <div className="text-zinc-400">
                  {showJokers ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>
              
              <AnimatePresence>
                {showJokers && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 mb-4">
                      {squad.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {squad.map(player => {
                            const isJoker = jokerPlayerIds.includes(player.id);
                            const isInAnyTeam = teams.some(t => t.playerIds.includes(player.id));
                            
                            return (
                              <button
                                key={player.id}
                                type="button"
                                onClick={() => toggleJoker(player.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  isJoker 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' 
                                    : isInAnyTeam
                                      ? 'bg-zinc-100 border-zinc-100 text-zinc-400 opacity-50 cursor-not-allowed'
                                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-300'
                                }`}
                                disabled={isInAnyTeam}
                              >
                                {player.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">Inga spelare i truppen än.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {teams.map((team, index) => (
                  <motion.div
                    key={team.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-white dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm shrink-0 overflow-visible">
                        <ColorPicker 
                          selectedColor={team.color} 
                          onChange={(color) => updateTeam(team.id, { color })} 
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="submit"
                          className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors p-2 shrink-0"
                          title="Spara övning"
                        >
                          <Save size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTeam(team.id)}
                          disabled={teams.length <= 1}
                          className="text-zinc-400 dark:text-zinc-600 hover:text-red-500 disabled:opacity-0 transition-colors p-2 shrink-0"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Välj spelare från truppen</label>
                      {squad.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {squad.map(player => {
                            const isSelected = team.playerIds.includes(player.id);
                            const isJoker = jokerPlayerIds.includes(player.id);
                            const isInOtherTeam = teams.some(t => t.id !== team.id && t.playerIds.includes(player.id));
                            
                            return (
                              <button
                                key={player.id}
                                type="button"
                                onClick={() => togglePlayerInTeam(team.id, player.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  isSelected 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' 
                                    : (isInOtherTeam || isJoker)
                                      ? 'bg-zinc-100 border-zinc-100 text-zinc-400 opacity-50 cursor-not-allowed'
                                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-300'
                                }`}
                                disabled={isInOtherTeam || isJoker}
                              >
                                {player.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">Inga spelare i truppen än. Gå till "Truppen" för att lägga till spelare.</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            {initialGame ? (
              <>
                <Check size={24} strokeWidth={3} />
                Spara ändringar
              </>
            ) : (
              <>
                <Play fill="currentColor" size={24} />
                Starta övningen
              </>
            )}
          </button>
        </form>
      </div>

      <AnimatePresence>
      </AnimatePresence>
    </motion.div>
  );
}
