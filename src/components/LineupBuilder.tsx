import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { SquadPlayer, Lineup, LineupPlayer } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { Plus, X, Trash2, Image as ImageIcon, User, Save, Share2, ClipboardList, Camera, Check, Gamepad2, Edit2, Download, Maximize2, Minimize2, Copy } from 'lucide-react';

interface LineupBuilderProps {
  squad: SquadPlayer[];
  lineup: Lineup | null;
  lineups: Lineup[];
  onUpdateLineup: (lineup: Lineup) => void;
  onSaveLineup: (lineup: Lineup) => void;
  onDeleteLineup: (id: string) => void;
  onSelectLineup: (id: string) => void;
  onCopyLineup: (id: string) => void;
  onUpdateSquad: (squad: SquadPlayer[]) => void;
  user: FirebaseUser | null;
}

export default function LineupBuilder({ 
  squad, 
  lineup, 
  lineups,
  onUpdateLineup, 
  onSaveLineup,
  onDeleteLineup,
  onSelectLineup,
  onCopyLineup,
  onUpdateSquad, 
  user 
}: LineupBuilderProps) {
  const [lineupName, setLineupName] = useState(lineup?.matchTitle || '');
  const [teamName, setTeamName] = useState(lineup?.teamName || '');
  const [players, setPlayers] = useState<LineupPlayer[]>(lineup?.players || []);
  const [playerScale, setPlayerScale] = useState(lineup?.playerScale || 1);
  const [nameTagStyle, setNameTagStyle] = useState<'light' | 'dark'>(lineup?.nameTagStyle || 'light');
  const [nameDisplayMode, setNameDisplayMode] = useState<'first' | 'last' | 'full'>(lineup?.nameDisplayMode || 'first');
  const [showNameBackground, setShowNameBackground] = useState(lineup?.showNameBackground ?? true);
  const [nameBackgroundType, setNameBackgroundType] = useState<'classic' | 'badge' | 'minimal'>(lineup?.nameBackgroundType || 'classic');
  const [showPhoto, setShowPhoto] = useState(lineup?.showPhoto ?? true);
  const [showNumber, setShowNumber] = useState(lineup?.showNumber ?? true);
  const [currentFormation, setCurrentFormation] = useState<string>(lineup?.formation || '');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<string | null>(null); // LineupPlayer id
  const [pickerMode, setPickerMode] = useState<'starter' | 'sub' | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number, y: number } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempTeamName, setTempTeamName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(async () => {
    if (exportRef.current === null) return;
    
    setIsExporting(true);
    // Allow a small delay for the state change to propagate to the DOM if needed, 
    // although React usually handles this before the next async step in most cases 
    // when using await.
    
    try {
      // Small timeout to ensure Reat has rendered the "isExporting" state
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const dataUrl = await toPng(exportRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${lineupName || 'laguppställning'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Kunde inte exportera bild:', err);
    } finally {
      setIsExporting(false);
    }
  }, [lineupName]);

  // Global listeners for dragging
  useEffect(() => {
    if (!draggingId) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!fieldRef.current) return;
      
      const rect = fieldRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      // Snapping
      const snapStep = 0.1;
      x = Math.round(x / snapStep) * snapStep;
      y = Math.round(y / snapStep) * snapStep;

      // Boundaries
      x = Math.max(2, Math.min(98, x));
      y = Math.max(2, Math.min(98, y));

      setDragPos({ x, y });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (draggingId && dragPos) {
        if (!fieldRef.current) return;
        const rect = fieldRef.current.getBoundingClientRect();
        
        // Determine if dropped inside field or bench
        const isInFieldX = e.clientX >= rect.left && e.clientX <= rect.right;
        const isInFieldY = e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (isInFieldX && isInFieldY) {
          // Drop on field
          updatePlayerPosition(draggingId, dragPos.x, dragPos.y);
          // If it was a sub, make it a starter
          const lp = players.find(p => p.id === draggingId);
          if (lp?.isSubstitute) {
            setPlayers(prev => prev.map(p => 
              p.id === draggingId ? { ...p, isSubstitute: false, x: dragPos.x, y: dragPos.y } : p
            ));
          }
        } else {
          // Drop outside field (assume bench)
          setPlayers(prev => prev.map(p => 
            p.id === draggingId ? { ...p, isSubstitute: true } : p
          ));
        }
      }
      setDraggingId(null);
      setDragPos(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingId, dragPos]);

  useEffect(() => {
    if (lineup) {
      setLineupName(prev => {
        if (prev !== lineup.matchTitle) return lineup.matchTitle;
        return prev;
      });
      setTeamName(prev => {
        if (prev !== (lineup.teamName || '')) return lineup.teamName || '';
        return prev;
      });
      setPlayers(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(lineup.players)) return lineup.players;
        return prev;
      });
      setPlayerScale(prev => {
        if (prev !== lineup.playerScale) return lineup.playerScale || 1;
        return prev;
      });
      setNameTagStyle(prev => {
         const style = lineup.nameTagStyle || 'light';
         if (prev !== style) return style;
         return prev;
      });
      setNameDisplayMode(prev => {
        const mode = lineup.nameDisplayMode || 'first';
        if (prev !== mode) return mode;
        return prev;
      });
      setShowNameBackground(prev => {
        const show = lineup.showNameBackground ?? true;
        if (prev !== show) return show;
        return prev;
      });
      setNameBackgroundType(prev => {
        const type = lineup.nameBackgroundType || 'classic';
        if (prev !== type) return type;
        return prev;
      });
      setShowPhoto(prev => {
        const show = lineup.showPhoto ?? true;
        if (prev !== show) return show;
        return prev;
      });
      setShowNumber(prev => {
        const show = lineup.showNumber ?? true;
        if (prev !== show) return show;
        return prev;
      });
      setCurrentFormation(prev => {
        const form = lineup.formation || '';
        if (prev !== form) return form;
        return prev;
      });
    } else {
      setLineupName('');
      setTeamName('');
      setPlayers([]);
      setPlayerScale(1);
      setNameTagStyle('light');
      setNameDisplayMode('first');
      setShowNameBackground(true);
      setNameBackgroundType('classic');
      setShowPhoto(true);
      setShowNumber(true);
      setCurrentFormation('');
    }
  }, [lineup]);

  // Auto-save changes back to the parent
  useEffect(() => {
    if (!lineup) return;
    const timeout = setTimeout(() => {
      onUpdateLineup({
        id: lineup.id,
        matchTitle: lineupName,
        teamName,
        date: Date.now(),
        players,
        playerScale,
        nameTagStyle,
        nameDisplayMode,
        showNameBackground,
        nameBackgroundType,
        showPhoto,
        showNumber,
        formation: currentFormation
      });
    }, 500); // Debounce for 500ms
    
    return () => clearTimeout(timeout);
  }, [lineupName, teamName, players, playerScale, nameTagStyle, nameDisplayMode, showNameBackground, nameBackgroundType, currentFormation, lineup?.id]);

  const FORMATIONS: Record<string, number[][]> = {
    '3-2-2-3': [[3, 75], [2, 60], [2, 42], [3, 20]],
    '3-2-4-1': [[3, 75], [2, 60], [4, 40], [1, 18]],
    '3-4-3': [[3, 75], [4, 45], [3, 18]],
    '3-5-2': [[3, 75], [5, 45], [2, 18]],
    '4-1-4-1': [[4, 75], [1, 58], [4, 38], [1, 18]],
    '4-2-3-1': [[4, 75], [2, 58], [3, 38], [1, 18]],
    '4-3-3': [[4, 75], [3, 45], [3, 18]],
    '4-4-1-1': [[4, 75], [4, 48], [1, 30], [1, 15]],
    '4-4-2': [[4, 75], [4, 45], [2, 15]],
  };

  const applyFormation = (formationKey: string) => {
    const formationData = FORMATIONS[formationKey];
    if (!formationData) return;

    setCurrentFormation(formationKey);

    const onField = players.filter(p => !p.isSubstitute);
    if (onField.length === 0) return;

    // Identify Goalkeeper: The specific player with the highest Y (closest to bottom)
    // and ideally central
    const gkIndex = onField.reduce((prevIdx, curr, currIdx, arr) => {
      const prev = arr[prevIdx];
      return curr.y > prev.y ? currIdx : prevIdx;
    }, 0);

    const gk = onField[gkIndex];
    const others = onField.filter((_, idx) => idx !== gkIndex);

    // Sort others by their current Y (to preserve general role) and then X
    others.sort((a, b) => {
      const yDiff = b.y - a.y; // Higher Y (bottom) first (Defenders)
      if (Math.abs(yDiff) > 10) return yDiff;
      return a.x - b.x; // Left to right
    });

    const newPlayers = [...players];
    
    // Position GK
    const gkInNew = newPlayers.find(p => p.id === gk.id);
    if (gkInNew) {
      gkInNew.x = 50;
      gkInNew.y = 90;
    }

    // Position others based on formation lines
    let playerIdx = 0;
    formationData.forEach(([count, y]) => {
      for (let i = 0; i < count; i++) {
        if (playerIdx < others.length) {
          const p = others[playerIdx];
          const pInNew = newPlayers.find(lp => lp.id === p.id);
          if (pInNew) {
            // Distribute across X
            // If count is 4: 20, 40, 60, 80
            // If count is 1: 50
            const xStep = 80 / (count + 1);
            pInNew.x = xStep * (i + 1) + 10;
            pInNew.y = y;
          }
          playerIdx++;
        }
      }
    });

    setPlayers(newPlayers);
  };

  const handleSave = () => {
    setIsEditingTitle(false);
  };

  const handleCreateNew = () => {
    const newLineup: Lineup = {
      id: crypto.randomUUID(),
      matchTitle: 'Ny Laguppställning',
      date: Date.now(),
      players: [],
      playerScale: 1,
      nameTagStyle: 'light'
    };
    onSaveLineup(newLineup);
  };

  const togglePlayerInLineup = (playerId: string, isSubstitute: boolean) => {
    const existingPlayer = players.find(p => p.playerId === playerId);
    
    if (existingPlayer) {
      // If it exists but with different status, update status
      if (existingPlayer.isSubstitute !== isSubstitute) {
        setPlayers(prev => prev.map(p => 
          p.playerId === playerId ? { ...p, isSubstitute } : p
        ));
      } else {
        // If it exists with same status, remove it
        setPlayers(prev => prev.filter(p => p.playerId !== playerId));
      }
    } else {
      // Add new player correctly positioned
      const newPlayer: LineupPlayer = {
        id: crypto.randomUUID(),
        playerId,
        x: 50,
        y: isSubstitute ? 95 : 50,
        isSubstitute
      };
      setPlayers(prev => [...prev, newPlayer]);
    }
  };

  const updatePlayerPosition = (id: string, x: number, y: number) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, x, y };
      }
      return p;
    }));
  };

  const toggleSubstitute = (id: string) => {
    setPlayers(prev => prev.map(p => 
      p.id === id ? { ...p, isSubstitute: !p.isSubstitute } : p
    ));
  };

  const removePlayer = (id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
    setSelectedForEdit(null);
  };

  const updateSquadPlayerInfo = (playerId: string, updates: Partial<SquadPlayer>) => {
    onUpdateSquad(squad.map(p => p.id === playerId ? { ...p, ...updates } : p));
  };

  const getVisibleName = (fullName: string) => {
    const parts = fullName.split(' ');
    if (nameDisplayMode === 'first') return parts[0];
    if (nameDisplayMode === 'last') return parts.length > 1 ? parts[parts.length - 1] : parts[0];
    return fullName;
  };

  const getSquadPlayer = (id: string) => squad.find(s => s.id === id);

  const starters = players.filter(p => !p.isSubstitute);
  const subs = players.filter(p => p.isSubstitute);

  return (
    <div className={`mx-auto transition-all duration-500 ${isMaximized ? 'fixed inset-0 z-50 bg-zinc-950 p-4 sm:p-8 md:p-12 overflow-y-auto' : 'max-w-2xl pb-32'}`}>
      {isMaximized && (
        <button
          onClick={() => setIsMaximized(false)}
          className="fixed top-6 right-6 z-[100] w-14 h-14 bg-zinc-900/80 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center shadow-2xl border border-zinc-800 hover:scale-110 active:scale-95 transition-all group"
          title="Lämna fullskärm"
        >
          <Minimize2 size={28} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}

      <div ref={exportRef} className={`bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl border border-zinc-100 dark:border-zinc-800 mb-6 ${isMaximized ? 'max-w-5xl mx-auto dark:bg-zinc-950 border-none shadow-none !p-0' : ''}`}>
        {/* Export Header - Title & Team Logo (Hidden in fullscreen for focus) */}
        {!isMaximized && (
          <div className="flex items-center justify-between mb-8 px-2">
            <div 
              className="flex flex-col cursor-pointer group/title"
              onClick={() => {
                setTempTitle(lineupName);
                setTempTeamName(teamName);
                setIsEditingTitle(true);
              }}
            >
              <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">
                  {teamName || 'Ditt Lag'}
                </h1>
                <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 tracking-tight leading-none flex items-center gap-2">
                  <span>{lineupName || 'Namnlös Match'}</span>
                  <Edit2 size={12} className="opacity-0 group-hover/title:opacity-100 transition-opacity" />
                </h2>
              </div>
              {(!lineupName && !teamName) && (
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">Tryck för att ändra rubriker</span>
              )}
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden xs:block">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{user.displayName}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Team Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-600">
                      <ImageIcon size={20} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* The Football Pitch */}
        <div 
          ref={fieldRef}
          className="relative aspect-[3/4] bg-[#8dc343] rounded-[40px] overflow-hidden border-[8px] border-white/20 shadow-2xl mb-8"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                to right,
                #8dc343,
                #8dc343 10%,
                #7db436 10%,
                #7db436 20%
              )
            `
          }}
        >
          {!lineup && (
            <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[2px] flex items-center justify-center p-8">
              <div className="bg-white/90 dark:bg-zinc-900/90 p-8 rounded-[32px] shadow-2xl border border-white dark:border-zinc-800 text-center max-w-xs scale-90 sm:scale-100">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 mx-auto">
                  <ClipboardList size={32} />
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Hämta trupp?</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 font-medium leading-relaxed">
                  Välj en sparad laguppställning nedan eller skapa en helt ny för att börja bygga.
                </p>
                <button
                  onClick={handleCreateNew}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none active:scale-95"
                >
                  Skapa Ny
                </button>
              </div>
            </div>
          )}

          {/* Main Field Lines Inset */}
          <div className="absolute top-[3%] bottom-[3%] left-[4%] right-[4%] border-2 border-white pointer-events-none" />
          
          {/* Center Line */}
          <div className="absolute top-1/2 left-[4%] right-[4%] h-[2px] bg-white" />
          
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] aspect-square border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>

          {/* TOP AREA */}
          <div className="absolute top-[3%] left-1/2 -translate-x-1/2 w-[55%] h-[17%] border-b-2 border-x-2 border-white pointer-events-none">
            {/* Goal Line Box */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[35%] h-[35%] border-b-2 border-x-2 border-white" />
            {/* Penalty Spot */}
            <div className="absolute top-[65%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          {/* TOP ARC - A shallow curved segment perfectly fitted to the box */}
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[22%] h-[6%] border-b-2 border-white rounded-b-full overflow-hidden pointer-events-none" />
          
          {/* BOTTOM AREA */}
          <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2 w-[55%] h-[17%] border-t-2 border-x-2 border-white pointer-events-none">
            {/* Goal Line Box */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[35%] h-[35%] border-t-2 border-x-2 border-white" />
            {/* Penalty Spot */}
            <div className="absolute bottom-[65%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          {/* BOTTOM ARC - A shallow curved segment perfectly fitted to the box */}
          <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[22%] h-[6%] border-t-2 border-white rounded-t-full overflow-hidden pointer-events-none" />

          {/* Goal markings (the small white goals at the very edges) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[15%] h-[3%] border-x-2 border-b-2 border-white/50" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[15%] h-[3%] border-x-2 border-t-2 border-white/50" />

          {/* Draggable Players on Field and Bench */}
          <AnimatePresence>
            {players.map((p) => {
              const sp = getSquadPlayer(p.playerId);
              if (!sp) return null;
              
              // Only render on field if not sub, OR if currently dragging
              const isDragging = draggingId === p.id;
              if (p.isSubstitute && !isDragging) return null;

              const displayX = isDragging && dragPos ? dragPos.x : p.x;
              const displayY = isDragging && dragPos ? dragPos.y : p.y;

              return (
                <div
                  key={p.id}
                  className={`absolute z-10 player-node group select-none transition-transform active:scale-110 ${
                    isEditMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                  } ${isDragging ? 'z-50' : ''}`}
                  style={{
                    left: `${displayX}%`,
                    top: `${displayY}%`,
                    touchAction: 'none',
                    transform: 'translate(-50%, -50%)',
                    transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                  onPointerDown={(e) => {
                    if (!isEditMode) {
                      setDraggingId(p.id);
                      setDragPos({ x: p.x, y: p.y });
                    }
                  }}
                  onClick={() => {
                    if (isEditMode) {
                      setSelectedForEdit(p.id);
                    }
                  }}
                >
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div 
                        className={`rounded-full border-2 bg-[#0f172a] overflow-hidden shadow-2xl transition-all ${
                          isEditMode 
                            ? 'border-indigo-500 ring-4 ring-indigo-500/20' 
                            : 'border-white group-hover:scale-110'
                        } ${isDragging ? 'scale-125 border-indigo-400' : ''}`}
                        style={{ 
                          width: `${3.5 * playerScale}rem`, 
                          height: `${3.5 * playerScale}rem`,
                          display: showPhoto ? 'flex' : 'none'
                        }}
                      >
                        {sp.photoUrl ? (
                          <img src={sp.photoUrl} alt={sp.name} className="w-full h-full object-cover pointer-events-none" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-900 to-indigo-950 flex items-center justify-center text-white/50">
                            <User size={24 * playerScale} />
                          </div>
                        )}
                        
                        {isEditMode && (
                          <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                            <Edit2 size={20 * playerScale} className="text-white" />
                          </div>
                        )}
                      </div>
                      {sp.number && showNumber && (
                        <div 
                          className="absolute bg-zinc-900 text-white rounded-full flex items-center justify-center font-black border-2 border-white shadow-lg"
                          style={{
                            width: `${1.5 * playerScale}rem`,
                            height: `${1.5 * playerScale}rem`,
                            fontSize: `${0.6 * playerScale}rem`,
                            bottom: showPhoto ? 0 : 'auto',
                            right: showPhoto ? 0 : 'auto',
                            top: !showPhoto ? '50%' : 'auto',
                            left: !showPhoto ? '50%' : 'auto',
                            transform: !showPhoto ? 'translate(-50%, -50%)' : 'none',
                            position: showPhoto ? 'absolute' : 'relative'
                          }}
                        >
                          {sp.number}
                        </div>
                      )}
                    </div>
                    <div className="mt-0">
                      <div 
                        className={`px-3 py-0.5 font-black text-center tracking-tight leading-tight transition-all ${
                          !showNameBackground 
                            ? (nameTagStyle === 'dark' ? 'text-zinc-900' : 'text-white shadow-sm') 
                            : (nameTagStyle === 'dark' ? 'bg-zinc-900 border border-zinc-800 text-white shadow-md' : 'bg-white text-black shadow-md')
                        } ${
                          nameBackgroundType === 'badge' ? 'rounded-full px-4' : 
                          nameBackgroundType === 'minimal' ? 'rounded-md px-2 py-0.5 shadow-none' : 
                          'rounded-xl'
                        }`}
                        style={{
                          fontSize: `${0.6 * playerScale}rem`,
                          opacity: isDragging ? 0.3 : 1,
                          backgroundColor: !showNameBackground ? 'transparent' : undefined,
                          border: !showNameBackground ? 'none' : undefined,
                        }}
                      >
                        {getVisibleName(sp.name).split(' ').map((part, i) => (
                          <div key={i}>{part}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Bench Area */}
        <div className="mb-0">
          <div className="flex flex-wrap gap-4 min-h-[64px] items-center p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            {subs.length === 0 ? (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 italic">Inga avbytare...</p>
            ) : (
              subs.map(p => {
                const sp = getSquadPlayer(p.playerId);
                if (!sp) return null;
                const isDragging = draggingId === p.id;
                
                return (
                  <div 
                    key={p.id} 
                    className={`flex flex-col items-center gap-0 cursor-pointer group transition-opacity ${isDragging ? 'opacity-0' : 'opacity-100'}`}
                    onPointerDown={(e) => {
                      if (!isEditMode) {
                        setDraggingId(p.id);
                        setDragPos({ x: 50, y: 90 }); 
                      }
                    }}
                    onClick={() => {
                      if (isEditMode) {
                        setSelectedForEdit(p.id)
                      }
                    }}
                  >
                      <div className="relative">
                        <div 
                          className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden shadow-sm group-hover:scale-110 transition-transform"
                          style={{
                            display: showPhoto ? 'flex' : 'none'
                          }}
                        >
                          {sp.photoUrl ? (
                            <img src={sp.photoUrl} alt={sp.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                              <User size={24} />
                            </div>
                          )}
                        </div>
                        {sp.number && showNumber && (
                          <div 
                            className="absolute bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm"
                            style={{
                              top: showPhoto ? '-4px' : '50%',
                              right: showPhoto ? '-4px' : '50%',
                              transform: showPhoto ? 'none' : 'translate(50%, -50%)',
                              position: showPhoto ? 'absolute' : 'relative',
                              zIndex: 10
                            }}
                          >
                            {sp.number}
                          </div>
                        )}
                      </div>
                    <div className="text-[10px] font-bold text-zinc-900 dark:text-white max-w-[64px] text-center leading-tight">
                      {getVisibleName(sp.name).split(' ').map((part, i) => (
                        <div key={i} className="truncate">{part}</div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!isMaximized && !isExporting && (
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-1 p-1.5 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <button
                onClick={() => setPickerMode('starter')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-xl transition-all font-black text-[10px] uppercase shadow-sm active:scale-95"
                title="Sätt startelva"
              >
                <Plus size={18} />
                <span>Plan</span>
              </button>
              <div className="w-[1px] h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
              <button
                onClick={() => setPickerMode('sub')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-xl transition-all font-black text-[10px] uppercase shadow-sm active:scale-95"
                title="Hantera bänk"
              >
                <Plus size={18} />
                <span>Bänk</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Controls & Functions - Reorganized at the bottom (Hidden in fullscreen) */}
      {!isMaximized && (
        <div className="flex flex-col gap-8 p-6 bg-zinc-50 dark:bg-zinc-950 rounded-3xl border border-zinc-100 dark:border-zinc-800">
          {/* Top Row: Scaling & Mode */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            {/* Left: Mode Toggle */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <button
                onClick={() => setIsEditMode(false)}
                className={`p-3 rounded-xl transition-all ${
                  !isEditMode 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                    : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
                title="Flytta spelare"
              >
                <Gamepad2 size={20} />
              </button>
              <button
                onClick={() => setIsEditMode(true)}
                className={`p-3 rounded-xl transition-all ${
                  isEditMode 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                    : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
                title="Redigera spelare"
              >
                <Edit2 size={20} />
              </button>
            </div>

            {/* Center: Scale Slider */}
            <div className="flex-1 min-w-[200px]">
               <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Storlek</span>
                  <span className="text-[10px] font-bold text-zinc-500">{Math.round(playerScale * 100)}%</span>
               </div>
               <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.05" 
                value={playerScale}
                onChange={(e) => setPlayerScale(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          {/* Middle Row: Formation Selection */}
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Formation</span>
                {currentFormation && (
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full uppercase">
                    Aktiv: {currentFormation}
                  </span>
                )}
             </div>
             <div className="flex flex-wrap gap-2">
                {Object.keys(FORMATIONS).map(form => (
                  <button
                    key={form}
                    onClick={() => applyFormation(form)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
                      currentFormation === form
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none translate-y-[-2px]'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-900 hover:text-indigo-600'
                    }`}
                  >
                    {form}
                  </button>
                ))}
             </div>
          </div>

          {/* Bottom Row: Theme & Name Styles */}
          <div className="flex flex-col gap-6">
             <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {/* Theme Style */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Tema</span>
                  <div className="flex gap-1 p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <button
                      onClick={() => setNameTagStyle('light')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameTagStyle === 'light'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      Ljus
                    </button>
                    <button
                      onClick={() => setNameTagStyle('dark')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameTagStyle === 'dark'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      Mörk
                    </button>
                  </div>
                </div>

                {/* Photo Toggle */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Visa Foto</span>
                  <button
                    onClick={() => setShowPhoto(!showPhoto)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                      showPhoto
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-100 dark:shadow-none'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {showPhoto ? 'Ja' : 'Nej'}
                    </span>
                    <Camera size={14} className={showPhoto ? 'text-white' : 'text-zinc-400'} />
                  </button>
                </div>

                {/* Number Toggle */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Visa Nr</span>
                  <button
                    onClick={() => setShowNumber(!showNumber)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                      showNumber
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-100 dark:shadow-none'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {showNumber ? 'Ja' : 'Nej'}
                    </span>
                    <div className={`w-3 h-3 rounded-md border-2 border-current transition-all flex items-center justify-center ${showNumber ? 'bg-white border-white' : 'border-zinc-400'}`}>
                      {showNumber && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-sm" />}
                    </div>
                  </button>
                </div>

                {/* Name Mode */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Namn</span>
                  <div className="flex gap-1 p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <button
                      onClick={() => setNameDisplayMode('first')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameDisplayMode === 'first'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Förnamn"
                    >
                      För
                    </button>
                    <button
                      onClick={() => setNameDisplayMode('last')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameDisplayMode === 'last'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Efternamn"
                    >
                      Efter
                    </button>
                    <button
                      onClick={() => setNameDisplayMode('full')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameDisplayMode === 'full'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Fullständigt"
                    >
                      Hela
                    </button>
                  </div>
                </div>

                {/* Background Type */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Form</span>
                  <div className="flex gap-1 p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <button
                      onClick={() => setNameBackgroundType('classic')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameBackgroundType === 'classic'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      Box
                    </button>
                    <button
                      onClick={() => setNameBackgroundType('badge')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameBackgroundType === 'badge'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      Badge
                    </button>
                    <button
                      onClick={() => setNameBackgroundType('minimal')}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        nameBackgroundType === 'minimal'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      Mini
                    </button>
                  </div>
                </div>

                {/* Background Toggle */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Bakgrund</span>
                  <button
                    onClick={() => setShowNameBackground(!showNameBackground)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                      showNameBackground
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-100 dark:shadow-none'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {showNameBackground ? 'På' : 'Av'}
                    </span>
                    <div className={`w-4 h-4 rounded-full border-2 border-current transition-transform ${showNameBackground ? 'bg-white translate-x-1' : '-translate-x-1'}`} />
                  </button>
                </div>
             </div>
             
             <div className="flex items-center justify-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    className="p-3 bg-white dark:bg-zinc-900 text-zinc-500 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-50 transition-all"
                    title="Exportera PNG"
                  >
                    <Download size={20} />
                  </button>
                  {isMaximized ? (
                    <button
                      onClick={() => setIsMaximized(false)}
                      className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
                      title="Lämna fullskärm"
                    >
                      <Minimize2 size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsMaximized(true)}
                      className="p-3 bg-white dark:bg-zinc-900 text-zinc-500 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-50 transition-all"
                      title="Fullskärm"
                    >
                      <Maximize2 size={20} />
                    </button>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}

      {!isMaximized && (
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Sparade Laguppställningar</h3>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95"
            >
              <Plus size={16} />
              <span>Skapa Ny</span>
            </button>
          </div>

          <div className="grid gap-3">
            {lineups.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-100 dark:border-zinc-800">
                <p className="text-zinc-400 font-medium italic">Inga sparade laguppställningar än...</p>
              </div>
            ) : (
              lineups.map(l => (
                <div 
                  key={l.id}
                  className={`group p-4 rounded-3xl border transition-all flex items-center justify-between ${
                    lineup?.id === l.id 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-200 dark:ring-indigo-800' 
                      : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex-1 cursor-pointer" onClick={() => onSelectLineup(l.id)}>
                    <h4 className="font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
                      {l.matchTitle || 'Namnlös Match'}
                    </h4>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-loose">
                      {new Date(l.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onCopyLineup(l.id)}
                      className="p-2.5 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                      title="Kopiera"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => onDeleteLineup(l.id)}
                      className="p-2.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                      title="Radera"
                    >
                      <Trash2 size={18} />
                    </button>
                    {lineup?.id !== l.id && (
                      <button
                        onClick={() => onSelectLineup(l.id)}
                        className="ml-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Öppna
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Overlays / Modals */}
      <AnimatePresence>
        {/** Title Edit Modal */}
        {isEditingTitle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setIsEditingTitle(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-6 tracking-tight">Redigera rubriker</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Lagnamn</label>
                  <input
                    autoFocus
                    type="text"
                    value={tempTeamName}
                    onChange={(e) => setTempTeamName(e.target.value)}
                    placeholder="Ditt lags namn..."
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-lg font-bold outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Matchrubrik</label>
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    placeholder="Namn på matchen..."
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-lg font-bold outline-none focus:border-indigo-600 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setLineupName(tempTitle);
                        setTeamName(tempTeamName);
                        handleSave();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-2xl active:scale-95 transition-all"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => {
                    setLineupName(tempTitle);
                    setTeamName(tempTeamName);
                    handleSave();
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
                >
                  Spara
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/** Player Selection Modal */}
        {pickerMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPickerMode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {pickerMode === 'starter' ? 'Välj startelva' : 'Välj bänk'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 uppercase font-bold tracking-tighter">
                    {players.length} spelare totalt i matchtruppen
                  </p>
                </div>
                <button onClick={() => setPickerMode(null)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {squad.map(sp => {
                  const itemInLineup = players.find(p => p.playerId === sp.id);
                  const isCurrentMode = itemInLineup && (
                    (pickerMode === 'starter' && !itemInLineup.isSubstitute) ||
                    (pickerMode === 'sub' && itemInLineup.isSubstitute)
                  );
                  const isOtherMode = itemInLineup && !isCurrentMode;

                  return (
                    <button
                      key={sp.id}
                      onClick={() => togglePlayerInLineup(sp.id, pickerMode === 'sub')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-left relative ${
                        isCurrentMode 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20' 
                          : isOtherMode
                            ? 'border-zinc-200 bg-zinc-100 opacity-60 grayscale'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800'
                      }`}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-400 shadow-sm overflow-hidden">
                          {sp.photoUrl ? (
                            <img src={sp.photoUrl} alt={sp.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        {isCurrentMode && (
                          <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-0.5 animate-in zoom-in">
                            <Check size={12} />
                          </div>
                        )}
                        {isOtherMode && (
                          <div className="absolute -top-2 -right-2 bg-zinc-400 text-white rounded-full p-0.5">
                            <span className="text-[8px] px-1 font-bold">{itemInLineup.isSubstitute ? 'AVB' : 'STA'}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white text-center line-clamp-1">{sp.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setPickerMode(null)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  Klar
                </button>
              </div>

              {squad.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-500 mb-4">Inga spelare i truppen än.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/** Player Detail Edit Modal */}
        {selectedForEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedForEdit(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const lp = players.find(p => p.id === selectedForEdit);
                const sp = lp ? getSquadPlayer(lp.playerId) : null;
                if (!lp || !sp) return null;

                return (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-zinc-100 dark:border-zinc-800">
                          {sp.photoUrl ? (
                            <img src={sp.photoUrl} alt={sp.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={32} className="text-zinc-400" />
                          )}
                        </div>
                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                          <Camera className="text-white" size={20} />
                          <input 
                            type="text" 
                            className="hidden" 
                            onBlur={(e) => updateSquadPlayerInfo(sp.id, { photoUrl: (e.target as any).value })}
                            onChange={(e) => {
                              const url = prompt("Klistra in länk till bild:", sp.photoUrl);
                              if (url !== null) updateSquadPlayerInfo(sp.id, { photoUrl: url });
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white leading-tight">{sp.name}</h3>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{sp.position || 'Okänd position'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Tröjnummer</label>
                        <input
                          type="text"
                          value={sp.number || ''}
                          onChange={(e) => updateSquadPlayerInfo(sp.id, { number: e.target.value })}
                          placeholder="#"
                          className="w-full px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <button
                          onClick={() => toggleSubstitute(lp.id)}
                          className={`w-full py-2 rounded-xl font-bold text-xs transition-all ${
                            lp.isSubstitute 
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' 
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {lp.isSubstitute ? 'Gör till ordinarie' : 'Gör till avbytare'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        onClick={() => setSelectedForEdit(null)}
                        className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold active:scale-95 transition-all text-sm"
                      >
                        Klar
                      </button>
                      <button
                        onClick={() => removePlayer(lp.id)}
                        className="w-full py-3 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all text-sm"
                      >
                        <Trash2 size={18} />
                        Ta bort från laguppställning
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
