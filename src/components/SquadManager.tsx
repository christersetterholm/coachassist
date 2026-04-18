import React, { useState, useRef } from 'react';
import { UserPlus, Trash2, Edit2, X, Check, Users, Upload, FileSpreadsheet, FileText, ClipboardList, Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { SquadPlayer } from '../types';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import ImageCropper from './ImageCropper';

interface SquadManagerProps {
  squad: SquadPlayer[];
  onUpdateSquad: (squad: SquadPlayer[]) => void;
  key?: React.Key;
}

export default function SquadManager({ squad, onUpdateSquad }: SquadManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<SquadPlayer | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<SquadPlayer | null>(null);
  const [pasteData, setPasteData] = useState('');
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const newPlayer: SquadPlayer = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        position: newPosition.trim() || undefined,
        number: newNumber.trim() || undefined,
        photoUrl: newPhotoUrl.trim() || undefined
      };
      onUpdateSquad([...squad, newPlayer]);
      setNewName('');
      setNewPosition('');
      setNewNumber('');
      setNewPhotoUrl('');
      setIsAdding(false);
    }
  };

  const handleClearSquad = () => {
    onUpdateSquad([]);
    setShowClearConfirm(false);
  };

  const handleRemove = (player: SquadPlayer) => {
    setPlayerToRemove(player);
  };

  const confirmRemove = () => {
    if (playerToRemove) {
      onUpdateSquad(squad.filter(p => p.id !== playerToRemove.id));
      setPlayerToRemove(null);
    }
  };

  const startEdit = (player: SquadPlayer) => {
    setEditingPlayer(player);
    setNewName(player.name);
    setNewPosition(player.position || '');
    setNewNumber(player.number || '');
    setNewPhotoUrl(player.photoUrl || '');
    setIsEditingModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingPlayer && newName.trim()) {
      onUpdateSquad(squad.map(p => 
        p.id === editingPlayer.id 
          ? { 
              ...p, 
              name: newName.trim(), 
              position: newPosition.trim() || undefined,
              number: newNumber.trim() || undefined,
              photoUrl: newPhotoUrl.trim() || undefined
            } 
          : p
      ));
      setIsEditingModalOpen(false);
      setEditingPlayer(null);
      setNewName('');
      setNewPosition('');
      setNewNumber('');
      setNewPhotoUrl('');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => setImageToCrop(reader.result as string));
    reader.readAsDataURL(file);
    
    // Reset file input so same file can be selected again
    if (e.target) e.target.value = '';
  };

  const onCropComplete = async (croppedBlob: Blob) => {
    setImageToCrop(null);
    setIsUploading(true);

    try {
      const user = auth.currentUser;
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;
      const storagePath = user 
        ? `users/${user.uid}/players/${fileName}`
        : `anonymous/players/${fileName}`;
      
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, croppedBlob);
      const url = await getDownloadURL(snapshot.ref);
      
      setNewPhotoUrl(url);
    } catch (err) {
      console.error('Photo upload error:', err);
      alert('Kunde inte ladda upp bilden till molnet. Kontrollera din anslutning.');
    } finally {
      setIsUploading(false);
    }
  };

  const processImportedData = (rows: string[][]) => {
    // rows is an array of [name, position, number, photoUrl]
    const newPlayers: SquadPlayer[] = rows
      .map(row => {
        const name = row[0]?.trim();
        const position = row[1]?.trim();
        const number = row[2]?.trim();
        const photoUrl = row[3]?.trim();
        return { name, position, number, photoUrl };
      })
      .filter(p => p.name && p.name.toLowerCase() !== 'namn' && p.name.toLowerCase() !== 'name')
      .map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        position: p.position || undefined,
        number: p.number || undefined,
        photoUrl: p.photoUrl || undefined
      }));
    
    if (newPlayers.length === 0) return;

    onUpdateSquad([...squad, ...newPlayers]);
    setIsImporting(false);
    setPasteData('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(file, {
        complete: (results) => {
          const rows = results.data as string[][];
          processImportedData(rows);
        },
        header: false
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
        processImportedData(data);
      };
      reader.readAsBinaryString(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteImport = () => {
    const lines = pasteData.split('\n').filter(l => l.trim());
    const rows = lines.map(line => {
      // Split by tab first (Excel/Sheets paste), then by comma or semicolon
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(';')) return line.split(';');
      if (line.includes(',')) return line.split(',');
      return [line];
    });
    processImportedData(rows);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-32">
      <div className="flex items-center justify-end gap-2 mb-8">
        <button
          onClick={() => setIsAdding(true)}
          className="p-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          title="Lägg till spelare"
        >
          <UserPlus size={20} />
        </button>
        <button
          onClick={() => setIsImporting(true)}
          className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-4 py-2 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
        >
          <Upload size={20} />
          <span>Importera</span>
        </button>
        {squad.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/30"
          >
            <Trash2 size={20} />
            <span>Rensa</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {isImporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsImporting(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Importera truppen</h3>
                <button onClick={() => setIsImporting(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all group"
                  >
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet size={24} />
                    </div>
                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Excel / CSV</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 opacity-50">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                      <FileText size={24} />
                    </div>
                    <span className="text-sm font-bold text-zinc-400">Google Sheets</span>
                    <p className="text-[10px] text-center text-zinc-400 -mt-2">Kopiera & klistra in nedan</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-4 pt-3 text-zinc-400">
                    <ClipboardList size={20} />
                  </div>
                  <textarea
                    value={pasteData}
                    onChange={(e) => setPasteData(e.target.value)}
                    placeholder="Klistra in här... 
Exempel:
Elias Lindgren	Målvakt	1	https://image.url
Kalle Karlsson	Mittback	4	https://image.url"
                    className="w-full h-40 pl-12 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  />
                </div>

                <button
                  onClick={handlePasteImport}
                  disabled={!pasteData.trim()}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  Importera från text
                </button>

                <p className="text-xs text-center text-zinc-400">
                  Tips: Du kan kopiera en kolumn med namn direkt från Excel eller Google Sheets och klistra in här.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleAdd}
            className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-100 dark:border-zinc-800 shadow-2xl mb-12"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Ny spelare</h3>
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              {/* Photo Upload for New Player */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-800 shadow-xl flex items-center justify-center text-zinc-400">
                    {isUploading ? (
                      <Loader2 size={32} className="animate-spin text-indigo-600" />
                    ) : newPhotoUrl ? (
                      <img src={newPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={32} />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:bg-indigo-700 active:scale-95 transition-all">
                    <Camera size={20} />
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  </label>
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Profilbild</span>
              </div>

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Namn</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Fullständigt namn..."
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-base font-bold outline-none focus:border-indigo-600 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Position</label>
                    <input
                      type="text"
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value)}
                      placeholder="Målvakt, Back..."
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-base font-bold outline-none focus:border-indigo-600 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Tröjnummer</label>
                    <input
                      type="text"
                      value={newNumber}
                      onChange={(e) => setNewNumber(e.target.value)}
                      placeholder="#"
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-base font-bold outline-none focus:border-indigo-600 transition-colors"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isUploading || !newName.trim()}
                      className="w-full h-[60px] bg-indigo-600 text-white font-black rounded-2xl active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
                    >
                      Lägg till spelare
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {squad.map((player) => (
            <motion.div
              layout
              key={player.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black border border-zinc-200 dark:border-zinc-800">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                  ) : (
                    player.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-white">{player.name}</span>
                    {player.number && (
                      <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black rounded-md text-zinc-500">
                         #{player.number}
                      </span>
                    )}
                  </div>
                  {player.position && (
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      {player.position}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(player)}
                  className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all active:scale-95 shadow-sm"
                  title="Redigera"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleRemove(player)}
                  className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/50 transition-all active:scale-95 shadow-sm"
                  title="Ta bort"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isEditingModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => {
              setIsEditingModalOpen(false);
              setEditingPlayer(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Redigera spelare</h3>
                <button 
                  onClick={() => {
                    setIsEditingModalOpen(false);
                    setEditingPlayer(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Photo Upload Section */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-800 shadow-xl flex items-center justify-center text-zinc-400">
                      {isUploading ? (
                        <Loader2 size={32} className="animate-spin text-indigo-600" />
                      ) : newPhotoUrl ? (
                        <img src={newPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Users size={32} />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:bg-indigo-700 active:scale-95 transition-all">
                      <Camera size={20} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ladda upp spelarbild</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Namn</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Spelarens namn..."
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-lg font-bold outline-none focus:border-indigo-600 transition-colors"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Position</label>
                      <input
                        type="text"
                        value={newPosition}
                        onChange={(e) => setNewPosition(e.target.value)}
                        placeholder="Expert..."
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-base font-bold outline-none focus:border-indigo-600 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Nummer</label>
                      <input
                        type="text"
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value)}
                        placeholder="#"
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-base font-bold outline-none focus:border-indigo-600 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isUploading || !newName.trim()}
                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
                  >
                    Spara ändringar
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingModalOpen(false);
                      setEditingPlayer(null);
                    }}
                    className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-2xl active:scale-95 transition-all underline decoration-1 underline-offset-4"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playerToRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPlayerToRemove(null)}
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
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Ta bort spelare?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-center">
                Är du säker på att du vill ta bort <span className="font-bold text-zinc-900 dark:text-white">{playerToRemove.name}</span> från truppen?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmRemove}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 dark:shadow-none"
                >
                  Ja, ta bort
                </button>
                <button
                  onClick={() => setPlayerToRemove(null)}
                  className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Avbryt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowClearConfirm(false)}
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
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Rensa truppen?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-center">
                Är du säker på att du vill ta bort alla spelare? Detta går inte att ångra.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleClearSquad}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 dark:shadow-none"
                >
                  Ja, rensa allt
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Avbryt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {squad.length === 0 && !isAdding && !isImporting && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center text-zinc-400 mx-auto mb-6">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Truppen är tom</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">Börja med att lägga till eller importera spelarna i ditt lag.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setIsAdding(true)}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all"
            >
              Lägg till spelare
            </button>
            <button
              onClick={() => setIsImporting(true)}
              className="w-full sm:w-auto bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-8 py-3 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              Importera trupp
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {imageToCrop && (
          <ImageCropper
            image={imageToCrop}
            onCropComplete={onCropComplete}
            onCancel={() => setImageToCrop(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
