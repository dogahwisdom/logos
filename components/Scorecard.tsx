import React from 'react';

interface ScorecardProps {
  reproducibility: number;
  logicGaps: number;
  integrity: string;
  theme: 'dark' | 'light';
}

export const Scorecard: React.FC<ScorecardProps> = ({ reproducibility, logicGaps, integrity, theme }) => {
  const isDark = theme === 'dark';

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getIntegrityColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('high')) return 'text-green-500';
    if (s.includes('med')) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Metric 1: Reproducibility */}
      <div className={`p-5 rounded-xl border flex items-center justify-between shadow-sm transition-colors ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
            isDark ? 'text-zinc-500' : 'text-zinc-500'
          }`}>Reproducibility Score</p>
          <div className={`text-2xl font-bold ${getScoreColor(reproducibility)}`}>
            {reproducibility}%
          </div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-opacity-10 ${
            reproducibility >= 80 ? 'bg-green-500' : 'bg-yellow-500'
        }`}>
          <i className={`fas fa-percentage ${
             reproducibility >= 80 ? 'text-green-500' : 'text-yellow-500'
          }`}></i>
        </div>
      </div>

      {/* Metric 2: Logic Gaps */}
      <div className={`p-5 rounded-xl border flex items-center justify-between shadow-sm transition-colors ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
            isDark ? 'text-zinc-500' : 'text-zinc-500'
          }`}>Logic Gaps Found</p>
          <div className={`text-2xl font-bold ${
            logicGaps > 2 ? 'text-red-500' : logicGaps > 0 ? 'text-yellow-500' : 'text-green-500'
          }`}>
            {logicGaps} <span className="text-sm font-normal text-zinc-500">Critical</span>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-opacity-10 ${
            logicGaps > 0 ? 'bg-red-500' : 'bg-green-500'
        }`}>
          <i className={`fas fa-bug ${
             logicGaps > 0 ? 'text-red-500' : 'text-green-500'
          }`}></i>
        </div>
      </div>

      {/* Metric 3: Citation Integrity */}
      <div className={`p-5 rounded-xl border flex items-center justify-between shadow-sm transition-colors ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
            isDark ? 'text-zinc-500' : 'text-zinc-500'
          }`}>Citation Integrity</p>
          <div className={`text-2xl font-bold ${getIntegrityColor(integrity)}`}>
            {integrity}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-opacity-10 bg-blue-500`}>
          <i className="fas fa-book-medical text-blue-500"></i>
        </div>
      </div>
    </div>
  );
};