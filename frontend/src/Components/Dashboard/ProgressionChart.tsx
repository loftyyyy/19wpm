import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import type { TestResult } from '../../types';

export default function ProgressionChart() {
  const [activeTab, setActiveTab] = useState<'wpm' | 'accuracy'>('wpm');
  const { getResults } = useAuth();
  const results = useMemo(() => getResults?.() ?? [], [getResults]);

  const chartData = useMemo(() => {
    const sorted = [...results].reverse();
    return sorted.map((r: TestResult, i: number) => ({
      name: `#${i + 1}`,
      wpm: r.wpm,
      accuracy: r.accuracy,
    }));
  }, [results]);

  return (
    <div className="px-4 md:px-20">
      <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-semibold text-text-main transition-theme">Progression</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('wpm')}
              className={`text-sm font-sans font-semibold transition-colors hover:cursor-pointer ${
                activeTab === 'wpm' ? 'text-accent underline underline-offset-4' : 'text-text-sub hover:text-text-main'
              }`}
            >
              WPM
            </button>
            <button
              onClick={() => setActiveTab('accuracy')}
              className={`text-sm font-sans font-semibold transition-colors hover:cursor-pointer ${
                activeTab === 'accuracy' ? 'text-accent underline underline-offset-4' : 'text-text-sub hover:text-text-main'
              }`}
            >
              Accuracy
            </button>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-text-dim font-sans text-sm transition-theme">
            Complete a test to see your progression.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="name" stroke="var(--text-dim)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--text-dim)" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                  }}
                  labelStyle={{ color: 'var(--text-sub)' }}
                />
                {activeTab === 'wpm' ? (
                  <Bar dataKey="wpm" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                ) : (
                  <Bar dataKey="accuracy" fill="var(--success)" radius={[6, 6, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
