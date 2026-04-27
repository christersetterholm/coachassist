import { SquadPlayer } from '../types';

export const POSITION_ORDER = [
  'MV', 'Målvakt',
  'MB', 'Mittback',
  'YB', 'Ytterback', 'VB', 'HB', 'Vänsterback', 'Högerback',
  'VMF', 'HMF', 'YMF', 'Yttermittfältare',
  'CM', 'CDM', 'CAM', 'MF', 'Mittfält', 'Innermittfältare',
  'FW', 'Forwards', 'Forward', 'Anfallare', 'ST', 'RW', 'LW'
];

export function getPositionRank(position?: string): number {
  if (!position) return 999;
  const p = position.toUpperCase();
  
  if (p.includes('MV') || p.includes('MÅLVAKT')) return 0;
  if (p.includes('MB') || p.includes('MITTBACK')) return 1;
  if (p.includes('YB') || p.includes('YTTERBACK') || p.includes('VB') || p.includes('HB') || p.includes('VÄNSTERBACK') || p.includes('HÖGERBACK')) return 2;
  
  // Yttermittfältare
  if (p.includes('VMF') || p.includes('HMF') || p.includes('YMF') || p.includes('YTTERMITTFÄLT')) return 3;
  
  // Innermittfältare
  if (p.includes('CM') || p.includes('CDM') || p.includes('CAM') || p.includes('INNERMITTFÄLT') || p.includes('MF') || p.includes('MITTFÄLT')) return 4;
  
  if (p.includes('FW') || p.includes('FORWARD') || p.includes('ANFALLARE') || p.includes('ST') || p.includes('RW') || p.includes('LW')) return 5;
  
  return 500;
}

export function sortPlayersByPosition(playerIds: string[], squad: SquadPlayer[]): string[] {
  return [...playerIds].sort((a, b) => {
    const playerA = squad.find(p => p.id === a);
    const playerB = squad.find(p => p.id === b);
    
    const rankA = getPositionRank(playerA?.position);
    const rankB = getPositionRank(playerB?.position);
    
    if (rankA !== rankB) return rankA - rankB;
    
    // If same rank, sort by name
    return (playerA?.name || '').localeCompare(playerB?.name || '');
  });
}
