import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import Cropper, { Area, Point } from 'react-easy-crop';
import { SquadPlayer, Lineup, LineupPlayer, FormationVariant, FormationPosition } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { Plus, X, Trash2, Image as ImageIcon, User, Save, Share2, ClipboardList, Camera, Check, Crosshair, Edit2, Download, Maximize2, Minimize2, Copy, Gamepad2, Upload, Pencil, ArrowUpRight, Eraser, RotateCcw, Trash, Circle, Shirt, Pin, PinOff } from 'lucide-react';

import { FORMATION_TEMPLATES } from '../lib/formations';

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
  customFormations?: FormationVariant[];
  pinnedFormationIds?: string[];
  onSaveCustomFormation?: (formation: FormationVariant) => void;
  onDeleteCustomFormation?: (id: string) => void;
  onTogglePinFormation?: (id: string) => void;
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
  customFormations = [],
  pinnedFormationIds = [],
  onSaveCustomFormation,
  onDeleteCustomFormation,
  onTogglePinFormation,
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
  const [teamLogoUrl, setTeamLogoUrl] = useState(lineup?.teamLogoUrl || '');
  const [pitchType, setPitchType] = useState<'classic' | 'grass' | 'blue' | 'solid-blue' | 'blue-stripes' | 'blue-grass'>(lineup?.pitchType || 'classic');
  const [currentFormation, setCurrentFormation] = useState<string>(lineup?.formation || '');
  
  // Custom Logo Upload States
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [logoToCrop, setLogoToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<string | null>(null); // LineupPlayer id
  const [pickerMode, setPickerMode] = useState<'starter' | 'sub' | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number, y: number } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Tactical Board State
  const [tacticalTool, setTacticalTool] = useState<'pen' | 'arrow' | 'eraser' | 'ball' | 'opponent'>('pen');
  const [tacticalDrawings, setTacticalDrawings] = useState<any[]>(lineup?.tacticalBoard?.drawings || []);
  const [tacticalLineType, setTacticalLineType] = useState<'solid' | 'dashed'>('solid');
  const [tacticalLineWidth, setTacticalLineWidth] = useState<number>(0.8);
  const [tacticalColor, setTacticalColor] = useState('#ffffff');
  const [footballPos, setFootballPos] = useState<{ x: number, y: number } | null>(lineup?.tacticalBoard?.footballPos || null);
  const [opponents, setOpponents] = useState<{ id: string, x: number, y: number }[]>(lineup?.tacticalBoard?.opponents || []);
  const [showOpponents, setShowOpponents] = useState(lineup?.tacticalBoard?.showOpponents ?? true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number, y: number }[]>([]);
  const [draggingBall, setDraggingBall] = useState(false);
  const [draggingOpponentId, setDraggingOpponentId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempTeamName, setTempTeamName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showFormationModal, setShowFormationModal] = useState(false);
  const [showSaveFormation, setShowSaveFormation] = useState(false);
  const [newFormationName, setNewFormationName] = useState('');
  const fieldRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Tactical Board Handlers
  const handleTacticalStart = (e: React.PointerEvent) => {
    if (!isMaximized || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (tacticalTool === 'ball') {
      setFootballPos({ x, y });
      setDraggingBall(true);
      return;
    }

    if (tacticalTool === 'opponent') {
      const newOpponent = { id: Math.random().toString(36).substr(2, 9), x, y };
      setOpponents(prev => [...prev, newOpponent]);
      return;
    }

    if (tacticalTool === 'eraser') {
      // Find and remove clicked drawing
      setTacticalDrawings(prev => prev.filter(d => {
        return !d.points.some((p: any) => Math.hypot(p.x - x, p.y - y) < 3);
      }));
      // Also remove opponents if clicked near
      setOpponents(prev => prev.filter(o => Math.hypot(o.x - x, o.y - y) > 5));
      return;
    }

    setIsDrawing(true);
    setCurrentPath([{ x, y }]);
  };

  const handleTacticalMove = (e: React.PointerEvent) => {
    if (!isMaximized || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (draggingBall) {
      setFootballPos({ x, y });
      return;
    }

    if (draggingOpponentId) {
      setOpponents(prev => prev.map(o => o.id === draggingOpponentId ? { ...o, x, y } : o));
      return;
    }

    if (!isDrawing) return;

    if (tacticalTool === 'pen') {
      setCurrentPath(prev => [...prev, { x, y }]);
    } else if (tacticalTool === 'arrow') {
      setCurrentPath(prev => [prev[0], { x, y }]);
    }
  };

  const handleTacticalEnd = () => {
    if (isDrawing) {
      if (currentPath.length > 1) {
        setTacticalDrawings(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          type: tacticalTool,
          points: currentPath,
          color: tacticalColor,
          lineType: tacticalLineType,
          lineWidth: tacticalLineWidth
        }]);
      }
      setIsDrawing(false);
      setCurrentPath([]);
    }
    setDraggingBall(false);
    setDraggingOpponentId(null);
  };

  const undoTactical = () => {
    setTacticalDrawings(prev => prev.slice(0, -1));
  };

  const clearTactical = () => {
    setTacticalDrawings([]);
    setFootballPos(null);
    setOpponents([]);
  };

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
      x = Number((Math.round(x / snapStep) * snapStep).toFixed(2));
      y = Number((Math.round(y / snapStep) * snapStep).toFixed(2));

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
          // If it was a sub, make it a starter, otherwise just update position
          setPlayers(prev => prev.map(p => 
            p.id === draggingId 
              ? { ...p, isSubstitute: false, x: dragPos.x, y: dragPos.y } 
              : p
          ));
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
      setTeamLogoUrl(prev => {
        if (prev !== (lineup.teamLogoUrl || '')) return lineup.teamLogoUrl || '';
        return prev;
      });
      setPitchType(prev => {
        const type = lineup.pitchType || 'classic';
        if (prev !== type) return type;
        return prev;
      });
      setCurrentFormation(prev => {
        const form = lineup.formation || '';
        if (prev !== form) return form;
        return prev;
      });

      // Update tactical board from remote data if different
      setTacticalDrawings(prev => {
        const remote = lineup.tacticalBoard?.drawings || [];
        if (JSON.stringify(prev) !== JSON.stringify(remote)) return remote;
        return prev;
      });
      setFootballPos(prev => {
        const remote = lineup.tacticalBoard?.footballPos || null;
        if (JSON.stringify(prev) !== JSON.stringify(remote)) return remote;
        return prev;
      });
      setOpponents(prev => {
        const remote = lineup.tacticalBoard?.opponents || [];
        if (JSON.stringify(prev) !== JSON.stringify(remote)) return remote;
        return prev;
      });
      setShowOpponents(prev => {
        const remote = lineup.tacticalBoard?.showOpponents ?? true;
        if (prev !== remote) return remote;
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
      setTeamLogoUrl('');
      setPitchType('classic');
      setCurrentFormation('');
    }
  }, [lineup]);

  // Auto-save changes back to the parent
  useEffect(() => {
    if (!lineup) return;
    
    // Create current state object for comparison
    const currentState: Lineup = {
      id: lineup.id,
      matchTitle: lineupName,
      teamName,
      date: lineup.date, // Use prop date for comparison
      players,
      playerScale,
      nameTagStyle,
      nameDisplayMode,
      showNameBackground,
      nameBackgroundType,
      showPhoto,
      showNumber,
      teamLogoUrl,
      pitchType,
      formation: currentFormation,
      tacticalBoard: {
        drawings: tacticalDrawings,
        footballPos,
        opponents,
        showOpponents
      }
    };

    // Skip if current local state is identical to what we got from props
    // This prevents the "ping-pong" effect when receiving remote updates
    const remoteTactical = lineup.tacticalBoard || {
      drawings: [],
      footballPos: null,
      opponents: [],
      showOpponents: true
    };

    const isDifferent = 
      lineup.matchTitle !== lineupName ||
      (lineup.teamName || '') !== teamName ||
      lineup.playerScale !== playerScale ||
      lineup.nameTagStyle !== nameTagStyle ||
      lineup.nameDisplayMode !== nameDisplayMode ||
      lineup.showNameBackground !== showNameBackground ||
      lineup.nameBackgroundType !== nameBackgroundType ||
      lineup.showPhoto !== showPhoto ||
      lineup.showNumber !== showNumber ||
      lineup.teamLogoUrl !== teamLogoUrl ||
      lineup.formation !== currentFormation ||
      pitchType !== lineup.pitchType ||
      JSON.stringify(lineup.players) !== JSON.stringify(players) ||
      JSON.stringify(remoteTactical) !== JSON.stringify(currentState.tacticalBoard);

    if (!isDifferent) return;

    const timeout = setTimeout(() => {
      onUpdateLineup({
        ...currentState,
        date: Date.now() // Set new date only when actually pushing changes
      });
    }, 300); // Debounce for 300ms
    
    return () => clearTimeout(timeout);
  }, [lineupName, teamName, players, playerScale, nameTagStyle, nameDisplayMode, showNameBackground, nameBackgroundType, currentFormation, showPhoto, showNumber, teamLogoUrl, pitchType, tacticalDrawings, footballPos, opponents, showOpponents, lineup?.id]);

  const applyFormation = (variant: FormationVariant) => {
    setCurrentFormation(variant.name);

    const onField = players.filter(p => !p.isSubstitute);
    if (onField.length === 0) return;

    // Identify Goalkeeper: The specific player with the highest Y (closest to bottom)
    const gkIndex = onField.reduce((prevIdx, curr, currIdx, arr) => {
      const prev = arr[prevIdx];
      return curr.y > prev.y ? currIdx : prevIdx;
    }, 0);

    const gk = onField[gkIndex];
    const others = onField.filter((_, idx) => idx !== gkIndex);

    // Sort others by their current Y (to preserve general role: Def -> Mid -> Att)
    others.sort((a, b) => {
      const yDiff = b.y - a.y; 
      if (Math.abs(yDiff) > 10) return yDiff;
      return a.x - b.x; // Left to right
    });

    const newPlayers = [...players];
    
    // Position GK (always central bottom)
    const gkInNew = newPlayers.find(p => p.id === gk.id);
    if (gkInNew) {
      gkInNew.x = 50;
      gkInNew.y = 94;
    }

    // Position others based on variant positions
    others.forEach((p, idx) => {
      if (idx < variant.positions.length) {
        const pInNew = newPlayers.find(lp => lp.id === p.id);
        if (pInNew) {
          pInNew.x = variant.positions[idx].x;
          pInNew.y = variant.positions[idx].y;
        }
      }
    });

    setPlayers(newPlayers);
    setShowFormationModal(false);
  };

  const handleSaveCurrentAsFormation = () => {
    if (!newFormationName.trim() || !onSaveCustomFormation) return;

    const onField = players.filter(p => !p.isSubstitute);
    if (onField.length !== 11) {
      alert("Du måste ha exakt 11 spelare på planen för att spara en formation.");
      return;
    }

    // GK is the one with highest Y
    const gkIndex = onField.reduce((prevIdx, curr, currIdx, arr) => {
      const prev = arr[prevIdx];
      return curr.y > prev.y ? currIdx : prevIdx;
    }, 0);

    const outfield = onField.filter((_, idx) => idx !== gkIndex);
    
    // Sort outfield for consistency (optional)
    outfield.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.x - b.x;
    });

    const newFormation: FormationVariant = {
      id: crypto.randomUUID(),
      name: newFormationName.trim(),
      description: `Egen formation skapad ${new Date().toLocaleDateString('sv-SE')}`,
      positions: outfield.map(p => ({ x: p.x, y: p.y }))
    };

    onSaveCustomFormation(newFormation);
    setNewFormationName('');
    setShowSaveFormation(false);
    setCurrentFormation(newFormation.name);
  };

  const handleSave = () => {
    setIsEditingTitle(false);
  };

  const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setLogoToCrop(reader.result as string);
        setShowLogoPicker(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const generateCroppedLogo = async () => {
    if (!logoToCrop || !croppedAreaPixels) return;

    try {
      const image = new Image();
      image.src = logoToCrop;
      await new Promise((resolve) => (image.onload = resolve));

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      const croppedDataUrl = canvas.toDataURL('image/png');
      setTeamLogoUrl(croppedDataUrl);
      setShowLogoPicker(false);
      setLogoToCrop(null);
      // Reset input value so same file can be uploaded again
      if (logoInputRef.current) logoInputRef.current.value = '';
    } catch (e) {
      console.error(e);
    }
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
    <div className={`mx-auto transition-all duration-500 ${isMaximized ? `fixed inset-0 z-50 bg-zinc-950 p-4 sm:p-8 md:p-12 ${isDrawing || draggingBall || draggingId || draggingOpponentId ? 'overflow-hidden' : 'overflow-y-auto'}` : 'max-w-2xl pt-2 sm:pt-4 pb-32'}`}>
      {isMaximized && (
        <>
          <button
            onClick={() => setIsMaximized(false)}
            className="fixed top-6 right-6 z-[100] w-14 h-14 bg-zinc-900/80 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center shadow-2xl border border-zinc-800 hover:scale-110 active:scale-95 transition-all group"
            title="Lämna fullskärm"
          >
            <Minimize2 size={28} className="group-hover:rotate-12 transition-transform" />
          </button>

          {/* Tactical Toolbar */}
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 p-3 bg-zinc-900/90 backdrop-blur-2xl rounded-[32px] border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-5 w-[95vw] max-w-2xl overflow-x-auto">
            <div className="flex items-center justify-between gap-4">
              {/* Tools row */}
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setTacticalTool('pen')}
                  className={`p-2.5 rounded-xl transition-all ${tacticalTool === 'pen' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                  title="Frihandspenna"
                >
                  <Pencil size={20} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => setTacticalTool('arrow')}
                  className={`p-2.5 rounded-xl transition-all ${tacticalTool === 'arrow' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                  title="Dra pilar"
                >
                  <ArrowUpRight size={20} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => setTacticalTool('ball')}
                  className={`p-2.5 rounded-xl transition-all ${tacticalTool === 'ball' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                  title="Placera boll"
                >
                  <Circle size={20} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => setTacticalTool('opponent')}
                  className={`p-2.5 rounded-xl transition-all ${tacticalTool === 'opponent' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                  title="Placera motståndare"
                >
                  <Shirt size={20} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => setTacticalTool('eraser')}
                  className={`p-2.5 rounded-xl transition-all ${tacticalTool === 'eraser' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                  title="Suddgummi"
                >
                  <Eraser size={20} strokeWidth={2.5} />
                </button>
              </div>

              {/* Settings row */}
              <div className="flex items-center gap-2">
                {/* Line Type */}
                <div className="flex bg-black/40 p-1 rounded-xl">
                  <button 
                    onClick={() => setTacticalLineType('solid')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${tacticalLineType === 'solid' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
                  >
                    Hela
                  </button>
                  <button 
                    onClick={() => setTacticalLineType('dashed')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${tacticalLineType === 'dashed' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
                  >
                    Sträck
                  </button>
                </div>

                {/* Line Width */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl">
                  <button 
                    onClick={() => setTacticalLineWidth(Math.max(0.4, tacticalLineWidth - 0.2))}
                    className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white"
                  >
                    -
                  </button>
                  <span className="text-[10px] font-black text-white w-6 text-center">{Math.round(tacticalLineWidth * 10)}</span>
                  <button 
                    onClick={() => setTacticalLineWidth(Math.min(2.0, tacticalLineWidth + 0.2))}
                    className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              {/* Show/Hide Opponents */}
              <button 
                onClick={() => setShowOpponents(!showOpponents)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showOpponents ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-600/20 text-red-400 border border-red-500/30'}`}
              >
                {showOpponents ? 'Dölj Motstånd' : 'Visa Motstånd'}
              </button>

              <div className="flex items-center gap-4">
                {/* Colors */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setTacticalColor('#ffffff')} className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-95 ${tacticalColor === '#ffffff' ? 'border-indigo-500 scale-110' : 'border-white bg-white'}`} style={{ backgroundColor: '#ffffff' }} />
                  <button onClick={() => setTacticalColor('#ef4444')} className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-95 ${tacticalColor === '#ef4444' ? 'border-indigo-500 scale-110' : 'border-red-500'}`} style={{ backgroundColor: '#ef4444' }} />
                  <button onClick={() => setTacticalColor('#facc15')} className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-95 ${tacticalColor === '#facc15' ? 'border-indigo-500 scale-110' : 'border-yellow-400'}`} style={{ backgroundColor: '#facc15' }} />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 border-l border-zinc-800 pl-4">
                  <button 
                    onClick={undoTactical}
                    className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all active:scale-90"
                    title="Ångra"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button 
                    onClick={clearTactical}
                    className="p-2 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
                    title="Radera allt"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div ref={exportRef} className={`bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl border border-zinc-100 dark:border-zinc-800 mb-4 ${isMaximized ? 'max-w-5xl mx-auto dark:bg-zinc-950 border-none shadow-none !p-0' : ''}`}>
        {/* Export Header - Title & Team Logo (Hidden in fullscreen for focus) */}
        {!isMaximized && (
          <div className="flex items-center justify-between mb-6 px-2">
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
            {/* Team Logo / Icon */}
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={logoInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleLogoUpload}
              />
              <div className="text-right hidden xs:block">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{user?.displayName || 'Gäst'}</p>
              </div>
              <button 
                onClick={() => logoInputRef.current?.click()}
                className="w-12 h-12 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm hover:border-indigo-400 transition-all active:scale-95 group/logo relative"
              >
                {teamLogoUrl ? (
                  <img src={teamLogoUrl} alt="Team Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : user?.photoURL ? (
                  <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">
                    <ImageIcon size={20} />
                  </div>
                )}
                {/* Subtle hover indicator */}
                <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload size={14} className="text-indigo-600" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* The Football Pitch */}
        <div 
          ref={fieldRef}
          className={`relative aspect-[2/3] rounded-[40px] overflow-hidden border-[8px] border-white/20 shadow-2xl mb-6 transition-colors duration-500 ${
            (pitchType === 'blue' || pitchType === 'solid-blue' || pitchType === 'blue-stripes' || pitchType === 'blue-grass') ? 'bg-sky-300' : 'bg-[#8dc343]'
          } ${isMaximized ? 'cursor-crosshair touch-none select-none' : ''}`}
          onPointerDown={handleTacticalStart}
          onPointerMove={handleTacticalMove}
          onPointerUp={handleTacticalEnd}
          onPointerLeave={handleTacticalEnd}
          style={{
            backgroundImage: (pitchType === 'classic' || pitchType === 'blue-stripes' || pitchType === 'blue') ? (
              `repeating-linear-gradient(
                to right,
                ${(pitchType === 'classic') ? '#8dc343' : '#7dd3fc'},
                ${(pitchType === 'classic') ? '#8dc343' : '#7dd3fc'} 10%,
                ${(pitchType === 'classic') ? '#7db436' : '#38bdf8'} 10%,
                ${(pitchType === 'classic') ? '#7db436' : '#38bdf8'} 20%
              )${(pitchType === 'blue' || pitchType === 'blue-grass') ? ', radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)' : ''}`
            ) : (pitchType === 'grass' || pitchType === 'blue-grass') ? (
              `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)`
            ) : 'none',
            backgroundSize: (pitchType === 'grass' || pitchType === 'blue' || pitchType === 'blue-grass') ? '20px 20px' : 'auto'
          }}
        >
          {/* Tactical Drawing Layer */}
          {isMaximized && (
            <svg 
              className="absolute inset-0 z-40 pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ width: '100%', height: '100%' }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill={tacticalColor} />
                </marker>
                {/* Specific colors if needed */}
                <marker id="arrowhead-white" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="white" /></marker>
                <marker id="arrowhead-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" /></marker>
                <marker id="arrowhead-yellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#facc15" /></marker>
              </defs>
              
              {/* Previous Drawings */}
              {tacticalDrawings.map((draw) => (
                <g key={draw.id}>
                  {draw.type === 'pen' ? (
                    <path
                      d={`M ${draw.points[0].x} ${draw.points[0].y} ${draw.points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ')}`}
                      fill="none"
                      stroke={draw.color}
                      strokeWidth={draw.lineWidth || 0.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={draw.lineType === 'dashed' ? "2, 1" : "none"}
                    />
                  ) : (
                    <line
                      x1={draw.points[0].x}
                      y1={draw.points[0].y}
                      x2={draw.points[1].x}
                      y2={draw.points[1].y}
                      stroke={draw.color}
                      strokeWidth={draw.lineWidth || 0.8}
                      strokeDasharray={draw.lineType === 'dashed' ? "2, 1" : "none"}
                      markerEnd={`url(#arrowhead-${draw.color === '#ffffff' ? 'white' : draw.color === '#ef4444' ? 'red' : 'yellow'})`}
                    />
                  )}
                </g>
              ))}

              {/* Current Drawing */}
              {isDrawing && currentPath.length > 1 && (
                <g>
                   {tacticalTool === 'pen' ? (
                    <path
                      d={`M ${currentPath[0].x} ${currentPath[0].y} ${currentPath.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`}
                      fill="none"
                      stroke={tacticalColor}
                      strokeWidth={tacticalLineWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={tacticalLineType === 'dashed' ? "2, 1" : "none"}
                    />
                  ) : (
                    <line
                      x1={currentPath[0].x}
                      y1={currentPath[0].y}
                      x2={currentPath[1].x}
                      y2={currentPath[1].y}
                      stroke={tacticalColor}
                      strokeWidth={tacticalLineWidth}
                      strokeDasharray={tacticalLineType === 'dashed' ? "2, 1" : "none"}
                      markerEnd={`url(#arrowhead-${tacticalColor === '#ffffff' ? 'white' : tacticalColor === '#ef4444' ? 'red' : 'yellow'})`}
                    />
                  )}
                </g>
              )}
            </svg>
          )}

          {/* Opponents Layer */}
          {isMaximized && showOpponents && opponents.map((opp) => (
            <div 
              key={opp.id}
              className={`absolute z-40 transition-none cursor-move select-none`}
              onPointerDown={(e) => {
                e.stopPropagation();
                setDraggingOpponentId(opp.id);
              }}
              style={{
                left: `${opp.x}%`,
                top: `${opp.y}%`,
                transform: 'translate(-50%, -50%)',
                width: `${playerScale * 50}px`,
                height: `${playerScale * 50}px`,
              }}
            >
              <div className="w-full h-full bg-zinc-800 rounded-full flex items-center justify-center shadow-lg border border-zinc-900 border-dashed">
                <Shirt size={playerScale * 24} className="text-zinc-400" />
              </div>
            </div>
          ))}

          {/* Football Icon */}
          {isMaximized && footballPos && (
            <div 
              className={`absolute z-50 transition-none pointer-events-none select-none`}
              style={{
                left: `${footballPos.x}%`,
                top: `${footballPos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center shadow-lg border border-zinc-200">
                <div className="w-full h-full rounded-full border-[3px] border-zinc-900 border-dashed" />
              </div>
            </div>
          )}
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
          <div className="absolute top-[2%] bottom-[2%] left-[4%] right-[4%] border-2 border-white pointer-events-none" />
          
          {/* Center Line */}
          <div className="absolute top-1/2 left-[4%] right-[4%] h-[2px] bg-white" />
          
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] aspect-square border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>

          {/* TOP AREA */}
          <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[55%] h-[14%] border-b-2 border-x-2 border-white pointer-events-none">
            {/* Goal Line Box */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[35%] h-[35%] border-b-2 border-x-2 border-white" />
            {/* Penalty Spot */}
            <div className="absolute top-[65%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          {/* TOP ARC - A shallow curved segment perfectly fitted to the box */}
          <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[22%] h-[6%] border-b-2 border-white rounded-b-full overflow-hidden pointer-events-none" />
          
          {/* BOTTOM AREA */}
          <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[55%] h-[14%] border-t-2 border-x-2 border-white pointer-events-none">
            {/* Goal Line Box */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[35%] h-[35%] border-t-2 border-x-2 border-white" />
            {/* Penalty Spot */}
            <div className="absolute bottom-[65%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          {/* BOTTOM ARC - A shallow curved segment perfectly fitted to the box */}
          <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[22%] h-[6%] border-t-2 border-white rounded-t-full overflow-hidden pointer-events-none" />

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
                    e.stopPropagation();
                    if (!isEditMode) {
                      setDraggingId(p.id);
                      setDragPos({ x: p.x, y: p.y });
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
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
                    <div className="mt-1">
                      <div 
                        className={`font-black text-center tracking-tight leading-tight transition-all flex flex-col items-center group/names ${
                          (nameBackgroundType === 'badge' || nameBackgroundType === 'transparent') ? (
                            `rounded-full px-2 py-0.5 shadow-md border ${
                              nameTagStyle === 'dark' 
                                ? (nameBackgroundType === 'transparent' ? 'bg-zinc-900/20 backdrop-blur-md text-white border-zinc-700/30' : 'bg-zinc-900 text-white border-zinc-800') 
                                : (nameBackgroundType === 'transparent' ? 'bg-white/20 backdrop-blur-md text-black border-white/30' : 'bg-white text-black border-zinc-200')
                            }`
                          ) : 'gap-0.5'
                        }`}
                        style={{
                          fontSize: `${0.6 * playerScale}rem`,
                          opacity: isDragging ? 0.3 : 1,
                        }}
                      >
                        {getVisibleName(sp.name).split(' ').map((part, i) => (
                          <div 
                            key={i} 
                            className={`truncate ${
                              nameBackgroundType === 'solid' ? (
                                `px-1.5 ${nameTagStyle === 'dark' ? 'bg-zinc-900 text-white' : 'bg-white text-black shadow-sm'}`
                              ) : 
                              (nameBackgroundType === 'badge' || nameBackgroundType === 'transparent') ? '' : 
                              (nameTagStyle === 'dark' ? 'text-zinc-900' : 'text-white drop-shadow-md')
                            }`}
                          >
                            {part}
                          </div>
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
          <div className={`p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-950 rounded-3xl border border-zinc-100 dark:border-zinc-800 transition-all ${
            subs.length > 6 
              ? 'grid grid-cols-4 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-4' 
              : 'flex flex-wrap justify-center gap-2 sm:gap-4'
          }`}>
            {subs.length === 0 ? (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 italic py-4">Inga avbytare...</p>
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
                      e.stopPropagation();
                      if (!isEditMode) {
                        setDraggingId(p.id);
                        setDragPos({ x: 50, y: 90 }); 
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditMode) {
                        setSelectedForEdit(p.id)
                      }
                    }}
                  >
                      <div className="relative">
                        <div 
                          className={`rounded-full border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden shadow-sm group-hover:scale-110 transition-all ${
                            subs.length <= 6 ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-14 sm:h-14'
                          }`}
                          style={{
                            display: showPhoto ? 'flex' : 'none'
                          }}
                        >
                          {sp.photoUrl ? (
                            <img src={sp.photoUrl} alt={sp.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                              <User size={subs.length <= 6 ? 18 : 22} className="sm:hidden" />
                              <User size={24} className="hidden sm:block" />
                            </div>
                          )}
                        </div>
                        {sp.number && showNumber && (
                          <div 
                            className={`absolute bg-indigo-600 text-white rounded-full flex items-center justify-center font-black border-2 border-white shadow-sm transition-all ${
                              subs.length <= 6 ? 'w-4 h-4 text-[8px] -top-1 -right-1' : 'w-5 h-5 text-[10px] -top-1 -right-1'
                            } sm:w-5 sm:h-5 sm:text-[10px] sm:-top-1 sm:-right-1`}
                            style={{
                              top: showPhoto ? undefined : '50%',
                              right: showPhoto ? undefined : '50%',
                              transform: showPhoto ? 'none' : 'translate(50%, -50%)',
                              position: showPhoto ? 'absolute' : 'relative',
                              zIndex: 10
                            }}
                          >
                            {sp.number}
                          </div>
                        )}
                      </div>
                    <div className={`font-bold text-zinc-900 dark:text-white max-w-[64px] text-center leading-tight transition-all ${
                      subs.length <= 6 ? 'text-[8px] sm:text-[10px]' : 'text-[9px] sm:text-[10px]'
                    }`}>
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
          <div className="flex flex-wrap justify-center items-center gap-3 mt-6">
            {/* Primary Action Group: Adding Players */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
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

            {/* Mode & Global Actions Group */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <button
                onClick={() => setIsEditMode(false)}
                className={`p-2.5 rounded-xl transition-all ${
                  !isEditMode 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                    : 'bg-white dark:bg-zinc-900 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm'
                }`}
                title="Flytta spelare"
              >
                <Crosshair size={20} />
              </button>
              <button
                onClick={() => setIsEditMode(true)}
                className={`p-2.5 rounded-xl transition-all ${
                  isEditMode 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                    : 'bg-white dark:bg-zinc-900 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm'
                }`}
                title="Redigera spelare"
              >
                <Edit2 size={20} />
              </button>
              <div className="w-[1px] h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
              <button
                onClick={handleExport}
                className="p-2.5 bg-white dark:bg-zinc-900 text-zinc-500 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
                title="Exportera PNG"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2.5 bg-white dark:bg-zinc-900 text-zinc-500 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
                title={isMaximized ? "Lämna fullskärm" : "Fullskärm"}
              >
                {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Controls & Functions - Reorganized at the bottom (Hidden in fullscreen) */}
      {!isMaximized && (
        <div className="flex flex-col gap-6 p-6 bg-zinc-50 dark:bg-zinc-950 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          {/* Section 1: Formations at the TOP */}
          <div className="flex flex-col gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Gamepad2 size={16} className="text-zinc-400" />
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Formationer</span>
                </div>
                {currentFormation && (
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full uppercase">
                    Vald: {currentFormation}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Dynamic Quick Access based on pins */}
                {pinnedFormationIds.map(id => {
                  // Check if it's a standard formation first
                  const temp = FORMATION_TEMPLATES.find(t => t.id === id);
                  if (temp) {
                    const variant = temp.variants[0];
                    const isSelected = currentFormation === variant.name;
                    return (
                      <button
                        key={id}
                        onClick={() => applyFormation(variant)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        {temp.name}
                      </button>
                    );
                  }

                  // Check if it's a custom formation
                  const custom = customFormations.find(f => f.id === id);
                  if (custom) {
                    const isSelected = currentFormation === custom.name;
                    return (
                      <button
                        key={id}
                        onClick={() => applyFormation(custom)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        {custom.name}
                      </button>
                    );
                  }

                  return null;
                })}
                
                {/* Fill defaults if no pins (fallback UX) */}
                {pinnedFormationIds.length === 0 && ['4-4-2', '4-3-3', '4-2-3-1'].map(id => {
                   const temp = FORMATION_TEMPLATES.find(t => t.id === id);
                   if (!temp) return null;
                   return (
                    <button
                      key={id}
                      onClick={() => applyFormation(temp.variants[0])}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 transition-all"
                    >
                      {temp.name}
                    </button>
                   );
                })}

                <button
                  onClick={() => setShowFormationModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>Fler formationer</span>
                </button>
                <button
                  onClick={() => setShowSaveFormation(true)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 dark:shadow-none"
                >
                  <Plus size={14} />
                  <span>Spara ny layout</span>
                </button>
              </div>
          </div>

          {/* Section 2: Layout Options */}
          <div className="flex flex-col gap-6 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 px-1">
              <ClipboardList size={16} className="text-zinc-400" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Layout</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {/* Theme Style */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Tema</span>
                <div className="flex gap-1 p-1 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => setNameTagStyle('light')}
                    className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                      nameTagStyle === 'light'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    Ljus
                  </button>
                  <button
                    onClick={() => setNameTagStyle('dark')}
                    className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                      nameTagStyle === 'dark'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">{showPhoto ? 'Ja' : 'Nej'}</span>
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
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">{showNumber ? 'Ja' : 'Nej'}</span>
                  <div className={`w-3 h-3 rounded-md border-2 border-current flex items-center justify-center ${showNumber ? 'bg-white border-white' : 'border-zinc-400'}`}>
                    {showNumber && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-sm" />}
                  </div>
                </button>
              </div>

              {/* Name Mode */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Namnformat</span>
                <div className="flex gap-1 p-1 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <button onClick={() => setNameDisplayMode('first')} className={`flex-1 px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${nameDisplayMode === 'first' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>För</button>
                  <button onClick={() => setNameDisplayMode('last')} className={`flex-1 px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${nameDisplayMode === 'last' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Efter</button>
                  <button onClick={() => setNameDisplayMode('full')} className={`flex-1 px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${nameDisplayMode === 'full' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Hela</button>
                </div>
              </div>

              {/* Background Type */}
              <div className="flex flex-col gap-2 col-span-2 md:col-span-3">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Namnskylt</span>
                <div className="flex gap-1 p-1 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <button onClick={() => {
                    setNameBackgroundType('badge');
                    setShowNameBackground(true);
                  }} className={`flex-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${nameBackgroundType === 'badge' && showNameBackground ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Badge</button>
                  <button onClick={() => {
                    setNameBackgroundType('transparent');
                    setShowNameBackground(true);
                  }} className={`flex-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${nameBackgroundType === 'transparent' && showNameBackground ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Genomskinlig</button>
                  <button onClick={() => {
                    setNameBackgroundType('solid');
                    setShowNameBackground(true);
                  }} className={`flex-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${nameBackgroundType === 'solid' && showNameBackground ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Bakgrund</button>
                  <button onClick={() => {
                    setNameBackgroundType('none');
                    setShowNameBackground(false);
                  }} className={`flex-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${(!showNameBackground || nameBackgroundType === 'none') ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Ingen</button>
                </div>
              </div>

              <div className="flex flex-col gap-2 col-span-2 md:col-span-3">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Planens utseende</span>
                <div className="grid grid-cols-2 xs:grid-cols-3 gap-1 p-1 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <button onClick={() => setPitchType('classic')} className={`px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${pitchType === 'classic' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Ränder</button>
                  <button onClick={() => setPitchType('blue-stripes')} className={`px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${pitchType === 'blue-stripes' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Blå Ränder</button>
                  <button onClick={() => setPitchType('grass')} className={`px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${pitchType === 'grass' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Gräs</button>
                  <button onClick={() => setPitchType('blue-grass')} className={`px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${pitchType === 'blue-grass' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Blå Gräs</button>
                  <button onClick={() => setPitchType('blue')} className={`px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${pitchType === 'blue' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Mix Blå</button>
                  <button onClick={() => setPitchType('solid-blue')} className={`px-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${pitchType === 'solid-blue' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}>Solid Blå</button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
               <div className="flex justify-between mb-3 px-1">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Spelarstorlek</span>
                  <span className="text-[10px] font-bold text-zinc-500 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md">{Math.round(playerScale * 100)}%</span>
               </div>
               <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.05" 
                value={playerScale}
                onChange={(e) => setPlayerScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
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
        {/* Logo Cropping Modal */}
        {showLogoPicker && logoToCrop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl border border-zinc-100 dark:border-zinc-800 w-full max-w-xl flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Beskär Klubblogo</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Anpassa logotypens utseende</p>
                </div>
                <button
                  onClick={() => setShowLogoPicker(false)}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="relative h-[400px] bg-zinc-100 dark:bg-zinc-950">
                <Cropper
                  image={logoToCrop}
                  crop={crop}
                  zoom={zoom}
                  minZoom={0.5}
                  restrictPosition={false}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape="rect"
                  showGrid={true}
                />
              </div>

              <div className="p-8 space-y-8 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Zoom</span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={0.5}
                    max={3}
                    step={0.01}
                    aria-label="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => {
                      setTeamLogoUrl(''); // Reset to default
                      setShowLogoPicker(false);
                      setLogoToCrop(null);
                    }}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
                  >
                    Nollställ till profil
                  </button>
                  <button
                    onClick={generateCroppedLogo}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2"
                  >
                    <Check size={18} strokeWidth={3} />
                    Spara Logga
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

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
        {/** Save Formation Name Modal */}
        <AnimatePresence>
          {showSaveFormation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4"
              onClick={() => setShowSaveFormation(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-zinc-50 dark:bg-zinc-950 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-white dark:border-zinc-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Spara formation</h3>
                  <button onClick={() => setShowSaveFormation(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Formationsnamn</label>
                    <input 
                      type="text"
                      placeholder="T.ex. 4-3-3 Offensiv"
                      value={newFormationName}
                      onChange={(e) => setNewFormationName(e.target.value)}
                      className="w-full h-14 px-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handleSaveCurrentAsFormation}
                    disabled={!newFormationName.trim()}
                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl active:scale-95 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    Spara Formation
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/** Formation Details Modal */}
        {showFormationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setShowFormationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-50 dark:bg-zinc-950 rounded-[40px] p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-white dark:border-zinc-900 custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Välj formation</h3>
                  <p className="text-sm text-zinc-500 font-medium mt-1">Utforska olika taktiska uppställningar för ditt lag.</p>
                </div>
                <button onClick={() => setShowFormationModal(false)} className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-600 shadow-sm">
                  <X size={24} />
                </button>
              </div>

            <div className="space-y-10">
                {customFormations.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="h-6 w-1 bg-emerald-600 rounded-full" />
                      <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Mina Formationer</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {customFormations.map((v) => (
                        <div key={v.id} className="relative group">
                          <button
                            onClick={() => applyFormation(v)}
                            className={`w-full text-left p-6 rounded-3xl border-2 transition-all hover:scale-[1.01] active:scale-[0.99] ${
                              currentFormation === v.name
                                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                                : 'border-white dark:border-zinc-900 bg-white dark:bg-zinc-900 shadow-sm'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-base font-black ${currentFormation === v.name ? 'text-emerald-600' : 'text-zinc-900 dark:text-white'}`}>
                                    {v.name}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                  {v.description}
                                </p>
                              </div>
                              <div className="hidden sm:flex shrink-0 w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                <div className="w-14 h-14 relative">
                                    <div className="absolute inset-0 border border-zinc-300 dark:border-zinc-600 rounded-md" />
                                    {v.positions.map((pos, idx) => (
                                      <div 
                                        key={idx} 
                                        className="absolute w-1 h-1 bg-emerald-500 rounded-full"
                                        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                                      />
                                    ))}
                                    <div className="absolute w-1 h-1 bg-emerald-500 rounded-full" style={{ left: '50%', top: '90%', transform: 'translate(-50%, -50%)' }} />
                                </div>
                              </div>
                            </div>
                          </button>
                          <div className="absolute top-4 right-4 flex gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinFormation?.(v.id);
                              }}
                              className={`p-2 rounded-full duration-200 ${
                                pinnedFormationIds.includes(v.id) 
                                  ? 'bg-amber-100 text-amber-600' 
                                  : 'text-zinc-400 hover:bg-zinc-100'
                              }`}
                              title={pinnedFormationIds.includes(v.id) ? "Avpinna" : "Pinna på startsidan"}
                            >
                              {pinnedFormationIds.includes(v.id) ? <PinOff size={16} /> : <Pin size={16} />}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCustomFormation?.(v.id);
                              }}
                              className="p-2 text-zinc-400 hover:text-red-500 rounded-full hover:bg-red-50 duration-200"
                              title="Radera"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {FORMATION_TEMPLATES.map((template) => (
                  <div key={template.id} className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="h-6 w-1 bg-indigo-600 rounded-full" />
                      <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tighter">{template.name} ({template.category})</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {template.variants.map((v) => {
                        const isPinned = pinnedFormationIds.includes(template.id);
                        return (
                          <div key={v.id} className="relative group">
                            <button
                              onClick={() => applyFormation(v)}
                              className={`w-full text-left p-6 rounded-3xl border-2 transition-all hover:scale-[1.01] active:scale-[0.99] ${
                                currentFormation === v.name
                                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20'
                                  : 'border-white dark:border-zinc-900 bg-white dark:bg-zinc-900 shadow-sm'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-base font-black ${currentFormation === v.name ? 'text-indigo-600' : 'text-zinc-900 dark:text-white'}`}>
                                      {v.name}
                                    </span>
                                    {currentFormation === v.name && (
                                      <div className="bg-indigo-600 text-white rounded-full p-1">
                                        <Check size={10} />
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                                    {v.description}
                                  </p>
                                </div>
                                <div className="hidden sm:flex shrink-0 w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-2xl items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                   <div className="w-16 h-16 relative">
                                      {/* Miniature pitch preview */}
                                      <div className="absolute inset-0 border border-zinc-300 dark:border-zinc-600 rounded-md" />
                                      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-zinc-300 dark:border-zinc-600" />
                                      {v.positions.map((pos, idx) => (
                                        <div 
                                          key={idx} 
                                          className="absolute w-1 h-1 bg-indigo-500 rounded-full"
                                          style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                                        />
                                      ))}
                                      <div className="absolute w-1 h-1 bg-indigo-500 rounded-full" style={{ left: '50%', top: '90%', transform: 'translate(-50%, -50%)' }} />
                                   </div>
                                </div>
                              </div>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinFormation?.(template.id);
                              }}
                              className={`absolute top-4 right-4 p-2 rounded-full duration-200 ${
                                isPinned 
                                  ? 'bg-amber-100 text-amber-600' 
                                  : 'text-zinc-400 hover:bg-zinc-100'
                              }`}
                              title={isPinned ? "Avpinna" : "Pinna på startsidan"}
                            >
                              {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
                            ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 select-none cursor-not-allowed'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800'
                      }`}
                    >
                      <div className="relative">
                        <div className={`w-10 h-10 bg-white dark:bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-400 shadow-sm overflow-hidden ${isOtherMode ? 'grayscale opacity-50' : ''}`}>
                          {sp.photoUrl ? (
                            <img src={sp.photoUrl} alt={sp.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        {sp.number && (
                          <div className={`absolute w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border-2 shadow-sm transition-all ${
                            isCurrentMode 
                              ? 'bg-white text-indigo-600 border-indigo-600 -top-1.5 -left-1.5' 
                              : 'bg-indigo-600 text-white border-white dark:border-zinc-900 -top-1.5 -right-1.5'
                          }`}>
                            {sp.number}
                          </div>
                        )}
                        {isCurrentMode && !sp.number && (
                          <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-0.5 animate-in zoom-in">
                            <Check size={12} />
                          </div>
                        )}
                        {isCurrentMode && sp.number && (
                          <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 animate-in zoom-in shadow-sm">
                            <Check size={10} />
                          </div>
                        )}
                        {isOtherMode && (
                          <div className="absolute -top-2 -right-2 bg-zinc-500 text-white rounded-full p-0.5 px-1.5 shadow-sm">
                            <span className="text-[7px] font-black uppercase tracking-tighter">{itemInLineup.isSubstitute ? 'BÄNK' : 'PLAN'}</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-black text-center line-clamp-1 uppercase tracking-tight ${
                        isOtherMode ? 'text-zinc-500 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'
                      }`}>
                        {sp.name}
                      </span>
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
