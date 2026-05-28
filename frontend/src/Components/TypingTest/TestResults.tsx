import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { TestResult } from '../../types';

function SparklineBar({ data }: { data: { time: number; wpm: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(d => d.wpm), 1);
  return (
    <div className="flex items-end gap-px h-24 w-full overflow-hidden">
      {data.map((point, i) => (
        <div
          key={i}
          className="flex-1 bg-accent/60 hover:bg-accent transition-colors rounded-t-sm"
          style={{ height: `${(point.wpm / max) * 100}%` }}
          title={`${point.time}s: ${point.wpm} wpm`}
        />
      ))}
    </div>
  );
}

export default function TestResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const result = (location.state as { result?: TestResult })?.result;

  const fallback = sessionStorage.getItem('19wpm-last-result');
  const safeResult: TestResult | null = result ?? (fallback ? JSON.parse(fallback) : null);

  if (!safeResult) {
    return (
      <div className="min-h-screen bg-surface transition-theme flex flex-col items-center justify-center gap-4">
        <p className="text-text-dim font-sans">No test result found.</p>
        <button
          onClick={() => navigate('/solo')}
          className="px-6 py-3 bg-accent text-white rounded-xl font-sans font-semibold hover:bg-accent-hover transition-colors hover:cursor-pointer"
        >
          Take a Test
        </button>
      </div>
    );
  }

  const minutes = safeResult.duration / 60;
  const grossWpm = minutes > 0 ? Math.round(safeResult.correctChars / 5 / minutes) : 0;
  const rawWpm = minutes > 0 ? Math.round((safeResult.correctChars + safeResult.incorrectChars) / 5 / minutes) : 0;

  return (
    <div className="min-h-screen bg-surface transition-theme">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-display font-bold text-text-main text-center mb-10 transition-theme">
          Test Complete
        </h1>

        <div className="bg-card border border-line rounded-2xl p-8 shadow-sm transition-theme">
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div className="text-center">
              <p className="text-5xl font-bold font-display text-accent transition-theme">
                {safeResult.wpm}
              </p>
              <p className="text-text-sub font-sans text-sm mt-1 transition-theme">WPM</p>
            </div>
            <div className="text-center">
              <p className={`text-5xl font-bold font-display transition-theme ${
                safeResult.accuracy >= 95 ? 'text-success' : safeResult.accuracy >= 80 ? 'text-accent' : 'text-error'
              }`}>
                {safeResult.accuracy}%
              </p>
              <p className="text-text-sub font-sans text-sm mt-1 transition-theme">Accuracy</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-text-sub font-sans text-sm font-semibold mb-3 transition-theme">WPM Burst Chart</p>
            <div className="bg-muted rounded-xl p-4 transition-theme">
              {safeResult.wpmHistory.length > 0 ? (
                <SparklineBar data={safeResult.wpmHistory} />
              ) : (
                <p className="text-text-dim text-sm font-sans text-center">No data available</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{safeResult.correctChars}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Correct</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{safeResult.incorrectChars}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Incorrect</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{safeResult.duration}s</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Duration</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{grossWpm}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Net WPM (correct only)</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{rawWpm}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Raw WPM (all keystrokes)</p>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-4 mb-8 transition-theme">
            <p className="text-text-sub font-sans text-sm font-semibold mb-2 transition-theme">Passage</p>
            <p className="text-text-dim font-sans text-sm leading-relaxed transition-theme">
              {safeResult.passage.length > 200
                ? safeResult.passage.slice(0, 200) + '...'
                : safeResult.passage}
            </p>
            <p className="text-text-dim font-sans text-xs mt-2 italic transition-theme">
              &mdash; {safeResult.author}, <em>{safeResult.source}</em>
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigate('/solo')}
              className="flex-1 px-6 py-3 bg-accent text-white rounded-xl font-sans font-semibold hover:bg-accent-hover transition-colors hover:cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
              className="flex-1 px-6 py-3 border border-accent text-accent rounded-xl font-sans font-semibold hover:bg-muted transition-colors hover:cursor-pointer"
            >
              View My Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
