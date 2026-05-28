import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import { useAuth } from '../context/AuthContext';
import type { TestResult, Duration } from '../types';

const durations: Duration[] = [15, 30, 60];

export default function Leaderboard() {
  const [selectedDuration, setSelectedDuration] = useState<Duration>(30);
  const { isAuthenticated, getResults } = useAuth();
  const navigate = useNavigate();

  const results = useMemo(() => getResults?.() ?? [], [getResults]);

  const ranked = useMemo(() => {
    const filtered = results.filter(r => r.duration === selectedDuration);
    const map = new Map<string, TestResult[]>();
    for (const r of filtered) {
      const day = r.date?.split('T')[0] ?? 'unknown';
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(r);
    }
    const bestPerDay: TestResult[] = [];
    for (const entries of map.values()) {
      entries.sort((a, b) => b.wpm - a.wpm);
      bestPerDay.push(entries[0]);
    }
    return bestPerDay.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [results, selectedDuration]);

  const allTimeBest = useMemo(() => {
    const filtered = results.filter(r => r.duration === selectedDuration);
    if (filtered.length === 0) return null;
    return filtered.reduce((best, r) => r.wpm > best.wpm ? r : best, filtered[0]);
  }, [results, selectedDuration]);

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
        <h1 className="text-3xl font-display font-bold text-text-main text-center mb-2 transition-theme">Leaderboard</h1>
        <p className="text-text-dim font-sans text-sm text-center mb-10 transition-theme">Track your daily bests.</p>

        <div className="flex items-center justify-center mb-10">
          <div className="bg-muted flex items-center justify-center p-1 gap-1 rounded-2xl shadow-sm transition-theme">
            {durations.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDuration(d)}
                className={`px-5 py-2 text-sm font-semibold font-sans rounded-xl transition-all hover:cursor-pointer ${
                  selectedDuration === d
                    ? 'bg-accent text-white'
                    : 'text-text-sub hover:text-text-main'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        {allTimeBest && (
          <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-6 mb-8 text-center transition-theme">
            <p className="text-text-sub font-sans text-xs font-semibold uppercase tracking-wider mb-1">All-Time Best</p>
            <p className="text-5xl font-bold font-display text-accent transition-theme">{allTimeBest.wpm}</p>
            <p className="text-text-dim font-sans text-xs mt-1 transition-theme">{allTimeBest.accuracy}% accuracy</p>
          </div>
        )}

        {!isAuthenticated ? (
          <div className="bg-card border border-line rounded-2xl p-8 text-center transition-theme">
            <p className="text-text-dim font-sans text-sm mb-4 transition-theme">Sign in to see your leaderboard.</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover transition-colors hover:cursor-pointer"
            >
              Sign In
            </button>
          </div>
        ) : ranked.length === 0 ? (
          <div className="bg-card border border-line rounded-2xl p-8 text-center transition-theme">
            <p className="text-text-dim font-sans text-sm transition-theme">No {selectedDuration}s tests yet.</p>
            <button
              onClick={() => navigate(`/solo?time=${selectedDuration}`)}
              className="mt-4 px-6 py-3 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover transition-colors hover:cursor-pointer"
            >
              Take a Test
            </button>
          </div>
        ) : (
          <div className="bg-card border border-line rounded-2xl overflow-hidden transition-theme">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">Date</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">WPM</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => (
                  <tr key={r.id} className="border-b border-line hover:bg-muted transition-colors">
                    <td className="py-3 px-4">
                      <span className={`text-sm font-bold font-sans ${i === 0 ? 'text-accent' : i < 3 ? 'text-text-main' : 'text-text-dim'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-sans text-text-main">
                      {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold font-sans text-accent text-right">{r.wpm}</td>
                    <td className="py-3 px-4 text-sm font-sans text-text-sub text-right">{r.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
