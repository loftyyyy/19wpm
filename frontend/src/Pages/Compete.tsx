import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import { useAuth } from '../context/AuthContext';
import type { Duration } from '../types';

const durations: Duration[] = [15, 30, 60];

export default function Compete() {
  const [selectedDuration, setSelectedDuration] = useState<Duration>(30);
  const { isAuthenticated, getResults } = useAuth();
  const navigate = useNavigate();

  const results = useMemo(() => getResults?.() ?? [], [getResults]);

  const pb = useMemo(() => {
    const filtered = results.filter(r => r.duration === selectedDuration);
    if (filtered.length === 0) return null;
    const sorted = [...filtered].sort((a, b) => b.wpm - a.wpm);
    return sorted[0];
  }, [results, selectedDuration]);

  const recent = useMemo(() => {
    const filtered = results.filter(r => r.duration === selectedDuration);
    return filtered.length > 0 ? filtered[0] : null;
  }, [results, selectedDuration]);

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
        <h1 className="text-3xl font-display font-bold text-text-main text-center mb-2 transition-theme">Compete</h1>
        <p className="text-text-dim font-sans text-sm text-center mb-10 transition-theme">Race against your personal best.</p>

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

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-line rounded-2xl p-6 text-center transition-theme">
            <p className="text-text-sub font-sans text-xs font-semibold uppercase tracking-wider mb-2">Personal Best</p>
            {pb ? (
              <>
                <p className="text-4xl font-bold font-display text-accent transition-theme">{pb.wpm}</p>
                <p className="text-text-dim font-sans text-xs mt-1 transition-theme">{pb.accuracy}% accuracy &middot; {pb.date ? new Date(pb.date).toLocaleDateString() : ''}</p>
              </>
            ) : (
              <p className="text-text-dim font-sans text-sm py-4 transition-theme">No {selectedDuration}s tests yet</p>
            )}
          </div>
          <div className="bg-card border border-line rounded-2xl p-6 text-center transition-theme">
            <p className="text-text-sub font-sans text-xs font-semibold uppercase tracking-wider mb-2">Last Test</p>
            {recent ? (
              <>
                <p className="text-4xl font-bold font-display text-text-main transition-theme">{recent.wpm}</p>
                <p className="text-text-dim font-sans text-xs mt-1 transition-theme">{recent.accuracy}% accuracy</p>
              </>
            ) : (
              <p className="text-text-dim font-sans text-sm py-4 transition-theme">No {selectedDuration}s tests yet</p>
            )}
          </div>
        </div>

        <div className="flex justify-center mb-12">
          <button
            onClick={() => navigate(`/solo?time=${selectedDuration}`)}
            className="px-10 py-4 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover transition-colors hover:cursor-pointer shadow-sm"
          >
            {pb ? 'Beat Your Best' : 'Take First Test'}
          </button>
        </div>

        {isAuthenticated && results.filter(r => r.duration === selectedDuration).length > 1 && (
          <div className="bg-card border border-line rounded-2xl p-6 transition-theme">
            <h2 className="text-lg font-display font-semibold text-text-main mb-4 transition-theme">All {selectedDuration}s Results</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results
                .filter(r => r.duration === selectedDuration)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 px-3 bg-muted rounded-xl transition-theme">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold font-sans text-accent">{r.wpm} wpm</span>
                      <span className="text-xs font-sans text-text-dim">{r.accuracy}%</span>
                    </div>
                    <span className="text-xs font-sans text-text-dim">
                      {new Date(r.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <div className="bg-muted border border-line rounded-2xl p-6 text-center transition-theme">
            <p className="text-text-dim font-sans text-sm transition-theme">
              <button onClick={() => navigate('/login')} className="text-accent font-semibold hover:underline hover:cursor-pointer">Sign in</button> to track your personal bests across sessions.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
