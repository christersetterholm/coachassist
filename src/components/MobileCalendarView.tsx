import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, MapPin, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Trophy, HelpCircle, FileText, CheckCircle, ArrowRight, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrainingSession, SquadPlayer } from '../types';

const SWEDISH_WEEKDAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

const SWEDISH_MONTHS = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
];

function getISOWeek(date: Date): number {
  const tempDate = new Date(date.valueOf());
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  return Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getSessionDurationInMinutes(startTime?: string, endTime?: string): number | null {
  if (!startTime || !endTime) return null;
  const startMatch = startTime.trim().match(/^(\d{1,2}):(\d{2})$/);
  const endMatch = endTime.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!startMatch || !endMatch) return null;
  
  const startMin = parseInt(startMatch[1], 10) * 60 + parseInt(startMatch[2], 10);
  const endMin = parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10);
  
  const diff = endMin - startMin;
  if (diff < 0) {
    return diff + 1440; // Past midnight
  }
  return diff;
}

function renderTextWithLinks(text: string) {
  if (!text) return null;
  // Regex to detect urls
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 font-extrabold"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

interface MobileCalendarViewProps {
  sessions: TrainingSession[];
  squad: SquadPlayer[];
  onSelectSession: (id: string, initialTab?: 'schema' | 'attendance') => void;
  isSyncing?: boolean;
  onSync?: () => Promise<void>;
  hasSyncUrl: boolean;
  onOpenSettings?: () => void;
}

export default function MobileCalendarView({
  sessions,
  squad,
  onSelectSession,
  isSyncing = false,
  onSync,
  hasSyncUrl,
  onOpenSettings
}: MobileCalendarViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'match' | 'training' | 'other'>('all');
  const [showPast, setShowPast] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);

  // States for month view
  const [viewMode, setViewMode] = useState<'list' | 'month'>(() => {
    try {
      const saved = localStorage.getItem('mobile_calendar_view_mode');
      if (saved === 'list' || saved === 'month') {
        return saved;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return 'month';
  });

  useEffect(() => {
    try {
      localStorage.setItem('mobile_calendar_view_mode', viewMode);
    } catch (e) {
      // Ignore
    }
  }, [viewMode]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    const futureEvents = sessions.filter(s => !s.isIgnored && s.date >= now.getTime());
    if (futureEvents.length > 0) {
      const sorted = [...futureEvents].sort((a, b) => a.date - b.date);
      const nearestDate = new Date(sorted[0].date);
      return new Date(nearestDate.getFullYear(), nearestDate.getMonth(), 1);
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setExpandedEventId(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setExpandedEventId(null);
  };

  const handleResetToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setExpandedEventId(null);
  };

  // Helper to categorize sessions based on title and metadata
  const categorizeSession = (session: TrainingSession): 'match' | 'training' | 'other' => {
    const title = (session.title || '').trim().toLowerCase();
    if (!title) {
      return 'training';
    }
    if (
      title.includes('match') || 
      title.includes('vs') || 
      title.includes('mot') || 
      title.includes('seriematch') || 
      title.includes('cup') || 
      title.includes('kval') || 
      title.includes('träningsmatch')
    ) {
      return 'match';
    }
    if (
      title.includes('träning') || 
      title.includes('pass') || 
      title.includes('fys') || 
      title.includes('praktik') || 
      title.includes('istid') || 
      title.includes('poolspel')
    ) {
      return 'training';
    }
    return 'other';
  };

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    const now = new Date();
    // Midday representation of today for accurate day comparisons
    const todayMidday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();

    return sessions
      .filter((s) => !s.isIgnored)
      .filter((s) => {
        // Apply historical filter
        const isPast = s.date < todayMidday;
        if (showPast) {
          return isPast; // Show only past events when showPast is true
        } else {
          return !isPast; // Show only future/current events by default
        }
      })
      .filter((s) => {
        // Match Search filter
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(query) ||
          (s.location || '').toLowerCase().includes(query) ||
          (s.notes || '').toLowerCase().includes(query) ||
          (s.description || '').toLowerCase().includes(query)
        );
      })
      .filter((s) => {
        // Apply category filter
        if (activeFilter === 'all') return true;
        return categorizeSession(s) === activeFilter;
      })
      .sort((a, b) => {
        // Chronological sorting: If showing future events, show nearest first. If past, show newest/recent first
        if (showPast) {
          // Newest / most recent past first
          return b.date - a.date || b.startTime.localeCompare(a.startTime);
        } else {
          // Nearest future first
          return a.date - b.date || a.startTime.localeCompare(b.startTime);
        }
      });
  }, [sessions, searchQuery, activeFilter, showPast]);

  // Group events by Month & Year (e.g. "Maj 2026")
  const groupedSessions = useMemo(() => {
    const groups: { [key: string]: TrainingSession[] } = {};
    
    filteredSessions.forEach((s) => {
      const dateObj = new Date(s.date);
      const monthYear = dateObj.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
      const key = monthYear.charAt(0).toUpperCase() + monthYear.slice(1); // Capitalize (e.g. "Maj 2026")
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(s);
    });

    return Object.entries(groups).map(([monthYear, items]) => ({
      monthYear,
      items
    }));
  }, [filteredSessions]);

  // Quick stats calculations for filters
  const stats = useMemo(() => {
    const now = new Date();
    const todayMidday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
    const activeList = sessions.filter(s => !s.isIgnored && (showPast ? s.date < todayMidday : s.date >= todayMidday));

    return {
      all: activeList.length,
      match: activeList.filter(s => categorizeSession(s) === 'match').length,
      training: activeList.filter(s => categorizeSession(s) === 'training').length,
      other: activeList.filter(s => categorizeSession(s) === 'other').length,
    };
  }, [sessions, showPast]);

  // Generate all calendar days for the current month view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let d = 1; d <= numDays; d++) {
      const dayDate = new Date(year, month, d);
      const dayOfWeek = dayDate.getDay();
      
      const dayEvents = sessions
        .filter(s => !s.isIgnored)
        .filter(s => {
          const sDate = new Date(s.date);
          return sDate.getFullYear() === year && sDate.getMonth() === month && sDate.getDate() === d;
        })
        .filter(s => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          return (
            s.title.toLowerCase().includes(query) ||
            (s.location || '').toLowerCase().includes(query) ||
            (s.notes || '').toLowerCase().includes(query) ||
            (s.description || '').toLowerCase().includes(query)
          );
        })
        .filter(s => {
          if (activeFilter === 'all') return true;
          return categorizeSession(s) === activeFilter;
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      // Show week number if it is Monday (1) or the 1st of the month
      const showWeekLabel = dayOfWeek === 1 || d === 1;
      const weekNumber = showWeekLabel ? getISOWeek(dayDate) : null;

      days.push({
        dayNumber: d,
        dayOfWeek,
        dayDate,
        events: dayEvents,
        weekNumber
      });
    }
    
    return days;
  }, [currentMonth, sessions, searchQuery, activeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedSessionId(prev => (prev === id ? null : id));
  };

  return (
    <div className="w-full font-sans pb-12">
      {/* Search and Quick Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-150 dark:border-zinc-805 shadow-sm mb-6 mx-4 sm:mx-0">
        {/* Toggleable Header Bar */}
        <div 
          onClick={() => setIsHeaderCollapsed(prev => !prev)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight uppercase tracking-wider">
              Aktivitetskalender
            </h2>
          </div>
          <div className="p-1.5 rounded-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-700/60 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 shrink-0 transition-colors">
            {isHeaderCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </div>

        {/* Collapsible content (Sync buttons, Future/Past toggle, search input) */}
        <AnimatePresence initial={false}>
          {!isHeaderCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-805/70 mt-4 space-y-4">
                {/* View mode toggle - Collapsible */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-805/50">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">Vy:</span>
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 text-[11px] font-bold">
                    <button
                      onClick={() => {
                        setViewMode('list');
                        setExpandedEventId(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg transition-all ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm font-black'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350'
                      }`}
                    >
                      Lista
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('month');
                        setExpandedEventId(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg transition-all ${
                        viewMode === 'month'
                          ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm font-black'
                          : 'text-zinc-505 hover:text-zinc-800 dark:hover:text-zinc-350'
                      }`}
                    >
                      Månadsvy
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">
                    Filtrera och synka:
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {/* Sync trigger button if sync URL exists */}
                    {onSync && hasSyncUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSync();
                        }}
                        disabled={isSyncing}
                        className="flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-650 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        title="Hämta senaste händelserna från laget.se"
                      >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        <span>{isSyncing ? 'Synkar...' : 'Uppdatera'}</span>
                      </button>
                    )}

                    {/* Past/Future toggle */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 text-[11px] font-bold">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPast(false);
                          setExpandedSessionId(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          !showPast
                            ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm font-black'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                        }`}
                      >
                        Kommande
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPast(true);
                          setExpandedSessionId(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          showPast
                            ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm font-black'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                        }`}
                      >
                        Historik
                      </button>
                    </div>

                    {/* Settings Cogwheel */}
                    {onOpenSettings && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSettings();
                        }}
                        className="p-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-all cursor-pointer shrink-0 flex items-center justify-center shadow-sm"
                        title="Kalenderinställningar"
                      >
                        <Settings size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Input for filter / Search bar */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Sök på händelse, plats eller anteckning..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-650"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filter Chips list */}
      <div className="flex gap-2.5 px-4 sm:px-0 overflow-x-auto pb-4 scrollbar-none">
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all shadow-sm shrink-0 border uppercase tracking-wider ${
            activeFilter === 'all'
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-zinc-900 dark:border-white'
              : 'bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
          }`}
        >
          <span>Alla</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === 'all' ? 'bg-white/20 dark:bg-black/10 text-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>{stats.all}</span>
        </button>

        <button
          onClick={() => setActiveFilter('match')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all shadow-sm shrink-0 border uppercase tracking-wider ${
            activeFilter === 'match'
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
          }`}
        >
          <Trophy size={12} className={activeFilter === 'match' ? 'text-white' : 'text-emerald-500'} />
          <span>Matcher</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === 'match' ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-650'}`}>{stats.match}</span>
        </button>

        <button
          onClick={() => setActiveFilter('training')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all shadow-sm shrink-0 border uppercase tracking-wider ${
            activeFilter === 'training'
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
          }`}
        >
          <Clock size={12} className={activeFilter === 'training' ? 'text-white' : 'text-indigo-500'} />
          <span>Träningar</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === 'training' ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650'}`}>{stats.training}</span>
        </button>

        <button
          onClick={() => setActiveFilter('other')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all shadow-sm shrink-0 border uppercase tracking-wider ${
            activeFilter === 'other'
              ? 'bg-amber-600 border-amber-500 text-white'
              : 'bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
          }`}
        >
          <HelpCircle size={12} className={activeFilter === 'other' ? 'text-white' : 'text-amber-500'} />
          <span>Övrigt</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === 'other' ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600'}`}>{stats.other}</span>
        </button>
      </div>

      {/* Month navigation selector for Månadsvy */}
      {viewMode === 'month' && (
        <div className="flex items-center justify-between px-4 sm:px-0 mb-4 select-none">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border border-zinc-150 dark:border-zinc-805 transition-all shadow-sm active:scale-95"
            title="Föregående månad"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-zinc-805 dark:text-zinc-100 uppercase tracking-wider">
              {SWEDISH_MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button
              onClick={handleResetToToday}
              className="text-[9px] font-black uppercase px-2 py-0.5 bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 rounded-md text-zinc-500 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-white transition-all"
            >
              Idag
            </button>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border border-zinc-150 dark:border-zinc-805 transition-all shadow-sm active:scale-95"
            title="Nästa månad"
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {viewMode === 'month' ? (
        <div className="px-4 sm:px-0 mt-2">
          {calendarDays.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center border-2 border-dashed border-zinc-150 dark:border-zinc-850 animate-fade-in">
              <div className="w-14 h-14 bg-zinc-50 dark:bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-3 text-zinc-400">
                <Calendar size={28} />
              </div>
              <h4 className="text-base font-black text-zinc-800 dark:text-zinc-200">
                Det här är tomt
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                Inga dagar kunde beräknas för vald månad.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-150 dark:border-zinc-805 shadow-sm overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-805">
              {calendarDays.map((day) => {
                const hasEvents = day.events.length > 0;
                const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                const weekLabel = day.weekNumber ? `v.${day.weekNumber}` : null;
                
                if (!hasEvents) {
                  return (
                    <div 
                      key={`empty-${day.dayNumber}`}
                      className={`flex items-center min-h-[44px] px-4 py-2 transition-colors gap-2 ${
                        isWeekend 
                          ? 'bg-zinc-200/65 dark:bg-zinc-50/15' 
                          : 'bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <div className={`w-9 text-xs font-bold leading-none shrink-0 ${
                        isWeekend 
                          ? 'text-zinc-400 dark:text-zinc-505 font-extrabold' 
                          : 'text-indigo-600 dark:text-indigo-400 font-black'
                      }`}>
                        {SWEDISH_WEEKDAYS[day.dayOfWeek]}
                      </div>

                      <div className="w-6 text-sm font-black text-zinc-900 dark:text-white leading-none shrink-0">
                        {day.dayNumber}
                      </div>

                      <div className="flex-1" />

                      <div className="w-12 text-right shrink-0">
                        {weekLabel && (
                          <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-505 tracking-tight uppercase">
                            {weekLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return day.events.map((session, idx) => {
                  const category = categorizeSession(session);
                  const isExpanded = expandedEventId === session.id;
                  const showDayDetails = idx === 0;

                  const attendingLeaderIds = squad.filter(p => p.role === 'leader').map(p => p.id);
                  const registeredLeadersCount = (session.attendance || []).filter(id => attendingLeaderIds.includes(id)).length;
                  const registeredPlayersCount = (session.attendance || []).length - registeredLeadersCount;
                  const totalPlayersSquad = squad.filter(p => p.role !== 'leader').length + (session.guestPlayers?.length || 0);
                  const totalLeadersSquad = squad.filter(p => p.role === 'leader').length;
                  const mapsUrl = session.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.location)}` : null;

                  const totalMinutes = session.moments?.reduce((acc, m) => acc + m.duration, 0) || 0;
                  const sessionDuration = getSessionDurationInMinutes(session.startTime, session.endTime);
                  
                  let durationText = '';
                  if (sessionDuration !== null && totalMinutes > 0) {
                    durationText = `${sessionDuration} min, Planerat: ${totalMinutes} min`;
                  } else if (sessionDuration !== null) {
                    durationText = `${sessionDuration} min`;
                  } else if (totalMinutes > 0) {
                    durationText = `Planerat: ${totalMinutes} min`;
                  }

                  return (
                    <React.Fragment key={`${day.dayNumber}-event-${session.id}`}>
                      <div 
                        onClick={() => setExpandedEventId(prev => prev === session.id ? null : session.id)}
                        className={`flex items-center justify-between min-h-[44px] px-4 py-2 gap-2 border-l-4 transition-all cursor-pointer select-none ${
                          category === 'match' ? 'border-l-rose-500' : category === 'training' ? 'border-l-emerald-500' : 'border-l-amber-500'
                        } ${
                          isExpanded
                            ? 'bg-zinc-50 dark:bg-zinc-850/40'
                            : isWeekend 
                              ? 'bg-zinc-200/65 dark:bg-zinc-50/15 hover:bg-zinc-200/85 dark:hover:bg-zinc-50/25' 
                              : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50/55 dark:hover:bg-zinc-850/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-9 text-xs font-bold leading-none shrink-0 ${
                            !showDayDetails 
                              ? 'opacity-0 pointer-events-none hidden sm:block' 
                              : isWeekend 
                                ? 'text-zinc-400 dark:text-zinc-505 font-extrabold' 
                                : 'text-indigo-600 dark:text-indigo-400 font-black'
                          }`}>
                            {SWEDISH_WEEKDAYS[day.dayOfWeek]}
                          </div>

                          <div className={`w-6 text-sm font-black text-zinc-900 dark:text-white leading-none shrink-0 ${
                            !showDayDetails ? 'opacity-0 pointer-events-none hidden sm:block' : ''
                          }`}>
                            {day.dayNumber}
                          </div>

                          <div className="w-11 text-xs font-bold text-zinc-505 dark:text-zinc-400 shrink-0">
                            {session.startTime || '18:00'}
                          </div>

                          <div className="flex-1 min-w-0 flex items-center gap-1.5 pl-1">
                            <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white truncate">
                              {(() => {
                                const rawTitle = session.title || 'Aktivitet';
                                let cleanTitle = rawTitle.replace(/match\s*/gi, '');
                                cleanTitle = cleanTitle.replace(/^[:\-\s]+/, '').trim();
                                if (cleanTitle) {
                                  return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
                                }
                                return rawTitle;
                              })()}
                            </span>

                            {(session.isCompleted || (() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const sDate = new Date(session.date);
                              sDate.setHours(0, 0, 0, 0);
                              return sDate.getTime() < today.getTime();
                            })()) && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.2 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 text-[8px] font-black rounded uppercase tracking-wider border border-green-150/40">
                                <CheckCircle size={8} />
                                <span>Klar</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {showDayDetails && weekLabel && (
                            <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-505 tracking-tight uppercase">
                              {weekLabel}
                            </span>
                          )}

                          <div className="p-1 rounded-full bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-400 shrink-0">
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800/70 overflow-hidden w-full"
                          >
                            <div className="p-4 text-xs font-medium space-y-4 text-left">
                              {/* Action buttons (Öppna Planering) */}
                              <div className="flex items-center justify-start pb-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectSession(session.id);
                                  }}
                                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 text-[10px] uppercase shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-95 cursor-pointer inline-flex"
                                >
                                  <span>Öppna Planering</span>
                                  <ArrowRight size={11} strokeWidth={2.5} />
                                </button>
                              </div>

                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectSession(session.id, 'attendance');
                                }}
                                className="bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-150 dark:border-zinc-805 shadow-sm p-3.5 rounded-xl cursor-pointer transition-all active:scale-[0.99] group/attendance"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="font-black text-[9px] text-zinc-400 group-hover/attendance:text-indigo-650 dark:group-hover/attendance:text-indigo-400 uppercase tracking-widest transition-colors">Anmälda spelare</p>
                                  <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-extrabold flex items-center gap-0.5 opacity-0 group-hover/attendance:opacity-100 transition-opacity">
                                    Hanteras här <ArrowRight size={10} />
                                  </span>
                                </div>
                                <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-bold">
                                  {totalLeadersSquad > 0 ? (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span>Spelarnärvaro:</span>
                                        <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-xs">
                                          {registeredPlayersCount} av {totalPlayersSquad}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-505 text-[11px]">
                                        <span>Ledarnärvaro:</span>
                                        <span>
                                          {registeredLeadersCount} av {totalLeadersSquad}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 font-bold">
                                        <span>Gemensam träningsnärvaro:</span>
                                        <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-xs">
                                          {registeredPlayersCount} av {totalPlayersSquad}
                                        </span>
                                    </div>
                                  )}
                                </div>
                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
                                  <div 
                                    className="bg-indigo-650 h-full rounded-full transition-all"
                                    style={{ width: `${totalPlayersSquad > 0 ? (registeredPlayersCount / totalPlayersSquad) * 105 : 0}%` }}
                                  />
                                </div>
                              </div>

                              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3 rounded-xl shadow-sm space-y-2">
                                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-bold">
                                  <Clock size={14} className="text-indigo-500" />
                                  <span>Tid: {session.startTime} {session.endTime ? `- ${session.endTime}` : ''} ({durationText})</span>
                                </div>
                                
                                {session.location && (
                                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-bold flex-wrap">
                                    <MapPin size={14} className="text-rose-500" />
                                    <span>Plats: {session.location}</span>
                                    {mapsUrl && (
                                      <a
                                        href={mapsUrl}
                                        target="_blank"
                                        referrerPolicy="no-referrer"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-955/45 dark:hover:bg-rose-900/30 dark:text-rose-450 border border-rose-150 dark:border-rose-955 px-1.5 py-0.5 rounded text-[9px] uppercase font-black tracking-tight"
                                      >
                                        <span>Kartor</span>
                                        <ExternalLink size={8} />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>

                              {session.notes ? (
                                <div className="bg-amber-50/75 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 p-3.5 rounded-xl shadow-sm mt-1.5">
                                  <div className="flex items-center gap-1.5 font-black text-[9px] text-amber-750 dark:text-amber-400 uppercase tracking-widest mb-2 border-b border-amber-200/30 dark:border-amber-900/30 pb-1.5">
                                    <FileText size={11} className="text-amber-500" />
                                    <span>Syfte & Anteckningar</span>
                                  </div>
                                  <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-bold break-words whitespace-pre-wrap select-text">
                                    {renderTextWithLinks(session.notes || '')}
                                  </p>
                                </div>
                              ) : null}

                              {session.description ? (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3.5 rounded-xl shadow-sm mt-1">
                                  <div className="flex items-center gap-1.5 font-black text-[9px] text-zinc-404 uppercase tracking-widest mb-2 border-b border-zinc-50 dark:border-zinc-805 pb-1.5">
                                    <FileText size={11} className="text-zinc-400" />
                                    <span>Information / Beskrivning</span>
                                  </div>
                                  <p className="text-zinc-650 dark:text-zinc-350 leading-relaxed font-bold break-words whitespace-pre-wrap select-text">
                                    {renderTextWithLinks(session.description || '')}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                });
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 sm:px-0 mt-2 space-y-8 animate-fade-in">
        {groupedSessions.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center border-2 border-dashed border-zinc-150 dark:border-zinc-850">
            <div className="w-14 h-14 bg-zinc-50 dark:bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <Calendar size={28} />
            </div>
            <h4 className="text-base font-black text-zinc-800 dark:text-zinc-200">
              Inga aktiviteter hittades
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              Testa att rensa sökningen, ändra filter eller synka med kalendern om du har en aktiv länk inlagd under Inställningar.
            </p>
          </div>
        ) : (
          groupedSessions.map((group) => (
            <div key={group.monthYear}>
              {/* Month Group Header */}
              <h3 className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-3 pl-1">
                {group.monthYear}
              </h3>

              {/* Items feed */}
              <div className="space-y-3.5">
                {group.items.map((session) => {
                  const category = categorizeSession(session);
                  const isExpanded = expandedSessionId === session.id;

                  // Date details
                  const dObj = new Date(session.date);
                  const weekdayStr = dObj.toLocaleDateString('sv-SE', { weekday: 'short' }).toUpperCase().replace('.', '');
                  const dayStr = dObj.getDate();
                  const monthStr = dObj.toLocaleDateString('sv-SE', { month: 'short' }).toUpperCase().replace('.', '');
                  
                  // Total minutes for local moments if exists
                  const totalMinutes = session.moments?.reduce((acc, m) => acc + m.duration, 0) || 0;
                  const sessionDuration = getSessionDurationInMinutes(session.startTime, session.endTime);
                  
                  let durationText = '';
                  if (sessionDuration !== null && totalMinutes > 0) {
                    durationText = `${sessionDuration} min, Planerat: ${totalMinutes} min`;
                  } else if (sessionDuration !== null) {
                    durationText = `${sessionDuration} min`;
                  } else if (totalMinutes > 0) {
                    durationText = `Planerat: ${totalMinutes} min`;
                  }

                  // Style depending on category
                  const catConfig = {
                    match: {
                      borderClass: 'border-l-4 border-emerald-500',
                      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 border-emerald-150',
                      label: 'Match',
                      icon: <Trophy size={11} strokeWidth={2.5} />
                    },
                    training: {
                      borderClass: 'border-l-4 border-indigo-500',
                      badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border-indigo-150',
                      label: 'Träning',
                      icon: <Clock size={11} strokeWidth={2.5} />
                    },
                    other: {
                      borderClass: 'border-l-4 border-amber-500',
                      badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-650 dark:text-amber-400 border-amber-150',
                      label: 'Övrigt',
                      icon: <HelpCircle size={11} strokeWidth={2.5} />
                    }
                  }[category];

                  // Attendance calculation
                  const attendingLeaderIds = squad.filter(p => p.role === 'leader').map(p => p.id);
                  const registeredLeadersCount = (session.attendance || []).filter(id => attendingLeaderIds.includes(id)).length;
                  const registeredPlayersCount = (session.attendance || []).length - registeredLeadersCount;

                  const totalPlayersSquad = squad.filter(p => p.role !== 'leader').length + (session.guestPlayers?.length || 0);
                  const totalLeadersSquad = squad.filter(p => p.role === 'leader').length;

                  // Maps URL
                  const mapsUrl = session.location
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.location)}`
                    : null;

                  return (
                    <div
                      key={session.id}
                      className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-150 dark:border-zinc-805 shadow-sm overflow-hidden transition-all duration-250 ${catConfig.borderClass}`}
                    >
                      {/* Main card interface */}
                      <div 
                        onClick={() => toggleExpand(session.id)}
                        className="p-4 cursor-pointer select-none active:bg-zinc-50/50 dark:active:bg-zinc-850/30 transition-colors"
                      >
                        {/* Title & Chevron Row at the very top (Spans full width) */}
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <h4 className="text-zinc-900 dark:text-white font-black text-sm uppercase tracking-tight group-hover:text-indigo-600 transition-colors select-text flex-1">
                            {(() => {
                              const rawTitle = session.title || 'Träning';
                              let cleanTitle = rawTitle.replace(/match\s*/gi, '');
                              // Remove leading colons, hyphens or spaces
                              cleanTitle = cleanTitle.replace(/^[:\-\s]+/, '').trim();
                              if (cleanTitle) {
                                return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
                              }
                              return rawTitle;
                            })()}
                          </h4>
                          {/* Chevron collapse indicator aligned with title */}
                          <div className="p-1.5 rounded-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-700/60 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 self-start">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>

                        {/* Details Row under the title */}
                        <div className="flex items-start gap-4">
                          {/* Compact Left Date Badge - Moved down slightly under title */}
                          <div className="flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950/60 rounded-xl px-2 py-1.5 min-w-[50px] border border-zinc-150 dark:border-zinc-800 text-center select-none shadow-inner shrink-0 leading-none">
                            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-0.5">
                              {weekdayStr}
                            </span>
                            <span className="text-lg font-black text-zinc-900 dark:text-white">
                              {dayStr}
                            </span>
                            <span className="text-[8px] font-black text-zinc-400 dark:text-zinc-500 tracking-wider mt-0.5">
                              {monthStr}
                            </span>
                          </div>

                          {/* Mid Details area */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-black rounded-lg uppercase tracking-wider ${catConfig.badgeClass}`}>
                                {catConfig.icon}
                                <span>{catConfig.label}</span>
                              </span>
                              
                              {(session.isCompleted || (() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const sDate = new Date(session.date);
                                sDate.setHours(0, 0, 0, 0);
                                return sDate.getTime() < today.getTime();
                              })()) && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 text-[9px] font-black rounded-lg uppercase tracking-wider border border-green-150/40">
                                  <CheckCircle size={9} />
                                  <span>Klar</span>
                                </span>
                              )}
                            </div>

                            {/* Time & Place row (Crucial information!) */}
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium">
                                <Clock size={12} className="text-zinc-900 dark:text-zinc-100 shrink-0" />
                                <span className="capitalize text-zinc-900 dark:text-white font-black">
                                  kl. {session.startTime} {session.endTime ? ` - ${session.endTime}` : ''}
                                </span>
                                {durationText && (
                                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                                    ({durationText})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-455 text-[11px] font-bold flex-wrap">
                                <MapPin size={12} className={session.location ? 'text-rose-500' : 'text-zinc-350'} />
                                <span className={`truncate select-text ${session.location ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-400 italic font-medium'}`}>
                                  {session.location || 'Plats ej angiven'}
                                </span>
                                {session.location && mapsUrl && (
                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/45 dark:hover:bg-rose-900/30 dark:text-rose-400 border border-rose-150 dark:border-rose-950 px-2 py-0.5 rounded-lg font-black tracking-tight text-[9px] uppercase transition-all active:scale-95 ml-1"
                                  >
                                    <span>Hitta dit</span>
                                    <ExternalLink size={9} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Smooth expandable detailed content drawer */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-zinc-50/60 dark:bg-zinc-950/25 border-t border-zinc-100 dark:border-zinc-805/70 overflow-hidden"
                          >
                            <div className="p-4 text-xs font-medium space-y-4">
                              {/* Action buttons (Öppna Planering) */}
                              <div className="flex items-center justify-start pb-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectSession(session.id);
                                  }}
                                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 text-[10px] uppercase shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-95 cursor-pointer inline-flex"
                                >
                                  <span>Öppna Planering</span>
                                  <ArrowRight size={11} strokeWidth={2.5} />
                                </button>
                              </div>

                              {/* Attendance snapshot */}
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectSession(session.id, 'attendance');
                                }}
                                className="bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-150 dark:border-zinc-805 shadow-sm p-3.5 rounded-xl cursor-pointer transition-all active:scale-[0.99] group/attendance"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="font-black text-[9px] text-zinc-400 group-hover/attendance:text-indigo-650 dark:group-hover/attendance:text-indigo-400 uppercase tracking-widest transition-colors">Anmälda spelare</p>
                                  <span className="text-[10px] text-indigo-655 dark:text-indigo-400 font-extrabold flex items-center gap-0.5 opacity-0 group-hover/attendance:opacity-100 transition-opacity">
                                    Öppna dörren till deltagare <ArrowRight size={10} />
                                  </span>
                                </div>
                                <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-bold">
                                  {totalLeadersSquad > 0 ? (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span>Spelarnärvaro:</span>
                                        <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-xs">
                                          {registeredPlayersCount} av {totalPlayersSquad}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[11px]">
                                        <span>Ledarnärvaro:</span>
                                        <span>
                                          {registeredLeadersCount} av {totalLeadersSquad}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 font-bold">
                                        <span>Gemensam träningsnärvaro:</span>
                                        <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-xs">
                                          {registeredPlayersCount} av {totalPlayersSquad}
                                        </span>
                                    </div>
                                  )}
                                </div>
                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
                                  <div 
                                    className="bg-indigo-650 h-full rounded-full transition-all"
                                    style={{ width: `${totalPlayersSquad > 0 ? (registeredPlayersCount / totalPlayersSquad) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>



                              {/* Syfte & Anteckningar (Coach notes) */}
                              {session.notes ? (
                                <div className="bg-amber-50/75 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 p-3.5 rounded-xl shadow-sm mt-1.5">
                                  <div className="flex items-center gap-1.5 font-black text-[9px] text-amber-750 dark:text-amber-400 uppercase tracking-widest mb-2 border-b border-amber-200/30 dark:border-amber-900/30 pb-1.5">
                                    <FileText size={11} className="text-amber-500" />
                                    <span>Syfte & Anteckningar</span>
                                  </div>
                                  <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-bold break-words whitespace-pre-wrap select-text">
                                    {renderTextWithLinks(session.notes || '')}
                                  </p>
                                </div>
                              ) : null}

                              {/* Information / Beskrivning (Practical synced calendar description) */}
                              {session.description ? (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3.5 rounded-xl shadow-sm mt-1">
                                  <div className="flex items-center gap-1.5 font-black text-[9px] text-zinc-404 uppercase tracking-widest mb-2 border-b border-zinc-50 dark:border-zinc-805 pb-1.5">
                                    <FileText size={11} className="text-zinc-400" />
                                    <span>Information / Beskrivning (från kalender)</span>
                                  </div>
                                  <p className="text-zinc-650 dark:text-zinc-350 leading-relaxed font-bold break-words whitespace-pre-wrap select-text">
                                    {renderTextWithLinks(session.description || '')}
                                  </p>
                                </div>
                              ) : null}

                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      )}

    </div>
  );
}
