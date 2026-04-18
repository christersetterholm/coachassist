import React, { useState } from 'react';
import { Pipette, ChevronDown, ChevronUp } from 'lucide-react';
import { PRESET_COLORS } from '../types';

interface ColorPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
}

const VEST_COLORS = [
  '#84CC16', // Lime
  '#0EA5E9', // Sky
  '#1E3A8A', // Navy
  '#71717A', // Zinc
  '#F97316', // Orange
];

export default function ColorPicker({ selectedColor, onChange }: ColorPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^#[0-9A-F]{0,6}$/i.test(value)) {
      onChange(value);
    }
  };

  // Filter out vest colors from the rest of the presets to avoid duplicates in the expanded view
  const otherColors = PRESET_COLORS.filter(
    color => !VEST_COLORS.some(vc => vc.toLowerCase() === color.toLowerCase())
  );

  return (
    <div className="relative space-y-2">
      <div className="flex items-center gap-1.5 py-1 px-1 -mx-1">
        {VEST_COLORS.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
              selectedColor.toLowerCase() === color.toLowerCase() 
                ? 'border-zinc-900 dark:border-white scale-125 shadow-md z-10' 
                : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: color }}
            title="Västfärg"
          />
        ))}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-6 h-6 rounded-full border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-all shrink-0 ${isExpanded ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-white dark:bg-zinc-950'}`}
        >
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {isExpanded && (
        <div className="absolute left-0 top-full mt-2 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 z-[70] w-64 sm:w-72">
          <div className="grid grid-cols-6 gap-2 p-1">
            {otherColors.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  selectedColor.toLowerCase() === color.toLowerCase() 
                    ? 'border-zinc-900 dark:border-white scale-110 shadow-md z-10' 
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={selectedColor}
                onChange={handleHexChange}
                placeholder="#000000"
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm uppercase"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Pipette size={16} />
              </div>
            </div>

            <div className="relative group">
              <input
                type="color"
                value={selectedColor.length === 7 ? selectedColor : '#6366f1'}
                onChange={(e) => onChange(e.target.value)}
                className="w-10 h-10 rounded-xl border-none p-0 cursor-pointer overflow-hidden shadow-sm hover:scale-105 transition-transform"
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                Välj fritt
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
