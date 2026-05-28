import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { TestResult, WpmPoint } from '../../types';

const CHART_HEIGHT = 180;
const BAR_AREA_HEIGHT = 140;
const ERROR_DOT_Y = 16;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 16;
const PEAK_BADGE_WIDTH = 80;
const INNER_RIGHT = PADDING_RIGHT + PEAK_BADGE_WIDTH + 8;

function WpmBurstChart({ data }: { data: WpmPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [tooltip, setTooltip] = useState<{ x: number; wpm: number; time: number; errors: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => setContainerWidth(el.clientWidth);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxWpm = useMemo(() => Math.max(...data.map(d => d.wpm), 1), [data]);
  const totalErrors = useMemo(() => data.reduce((s, d) => s + d.errors, 0), [data]);
  const avgWpm = useMemo(() => Math.round(data.reduce((s, d) => s + d.wpm, 0) / data.length), [data]);

  const innerWidth = containerWidth - PADDING_LEFT - INNER_RIGHT;
  const barGap = Math.max(0.5, Math.min(2, innerWidth / data.length * 0.08));
  const barWidth = Math.max(3, (innerWidth - barGap * (data.length - 1)) / data.length);
  const svgWidth = containerWidth;

  const peakPoint = useMemo(() => {
    let peak = data[0];
    for (const p of data) if (p.wpm > peak.wpm) peak = p;
    return peak;
  }, [data]);

  return (
    <div ref={containerRef} className="w-full relative">
      <svg width={svgWidth} height={CHART_HEIGHT} className="select-none block">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75].map(frac => {
          const y = BAR_AREA_HEIGHT + 4 - (BAR_AREA_HEIGHT - 4) * frac;
          const label = Math.round(maxWpm * frac);
          return (
            <g key={frac}>
              <line x1={PADDING_LEFT} y1={y} x2={svgWidth - INNER_RIGHT} y2={y} stroke="var(--line)" strokeOpacity="0.4" strokeDasharray="3 3" />
              <text x={PADDING_LEFT - 6} y={y + 4} textAnchor="end" fill="var(--text-dim)" fontSize="10" fontFamily="var(--font-sans)">
                {label}
              </text>
            </g>
          );
        })}

        {data.map((point, i) => {
          const x = PADDING_LEFT + i * (barWidth + barGap);
          const barH = Math.max(1, (point.wpm / maxWpm) * (BAR_AREA_HEIGHT - 4));
          const y = BAR_AREA_HEIGHT + 4 - barH;

          return (
            <g
              key={i}
              onMouseEnter={() => setTooltip({ x: x + barWidth / 2, wpm: point.wpm, time: point.time, errors: point.errors })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={x} y={y} width={barWidth} height={barH} rx={2} fill="url(#barGrad)" />
              {point.errors > 0 && (
                <circle cx={x + barWidth / 2} cy={ERROR_DOT_Y} r={3} fill="var(--error)" opacity={0.8} />
              )}
              <rect x={x} y={0} width={barWidth} height={BAR_AREA_HEIGHT + 4} fill="transparent" />
            </g>
          );
        })}

        <line x1={PADDING_LEFT} y1={BAR_AREA_HEIGHT + 4} x2={svgWidth - INNER_RIGHT} y2={BAR_AREA_HEIGHT + 4} stroke="var(--line)" strokeWidth="1" />

        {data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((point, j, filtered) => {
          const idx = data.indexOf(point);
          const x = PADDING_LEFT + idx * (barWidth + barGap) + barWidth / 2;
          const show = filtered.length <= 8 || j % 2 === 0;
          return (
            <g key={idx}>
              <line x1={x} y1={BAR_AREA_HEIGHT + 4} x2={x} y2={BAR_AREA_HEIGHT + 8} stroke="var(--line)" />
              {show && (
                <text x={x} y={BAR_AREA_HEIGHT + 20} textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-sans)">
                  {point.time}s
                </text>
              )}
            </g>
          );
        })}

        {peakPoint && (
          <g transform={`translate(${svgWidth - INNER_RIGHT + 8}, 8)`}>
            <rect width={PEAK_BADGE_WIDTH} height={44} rx={6} fill="var(--muted)" />
            <text x={PEAK_BADGE_WIDTH / 2} y={18} textAnchor="middle" fill="var(--accent)" fontSize="14" fontWeight="700" fontFamily="var(--font-display)">
              {peakPoint.wpm}
            </text>
            <text x={PEAK_BADGE_WIDTH / 2} y={36} textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-sans)">
              peak wpm
            </text>
          </g>
        )}
      </svg>

      {tooltip && (
        <div
          className="absolute z-10 bg-card border border-line rounded-lg px-3 py-2 shadow-lg pointer-events-none transition-theme"
          style={{
            left: Math.min(tooltip.x - 40, containerWidth - 100),
            top: -8,
          }}
        >
          <p className="text-sm font-bold font-display text-accent">{tooltip.wpm} wpm</p>
          <p className="text-xs font-sans text-text-sub mt-0.5">
            {tooltip.time}s {tooltip.errors > 0 && <span className="text-error">&middot; {tooltip.errors} {tooltip.errors === 1 ? 'error' : 'errors'}</span>}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 text-xs font-sans text-text-dim">
        <div className="flex gap-4">
          <span>Peak: <strong className="text-accent">{peakPoint.wpm}</strong> wpm</span>
          <span>Avg: <strong className="text-text-main">{avgWpm}</strong> wpm</span>
        </div>
        <div className="flex items-center gap-3">
          {totalErrors > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-error inline-block" />
              {totalErrors} {totalErrors === 1 ? 'error' : 'errors'}
            </span>
          )}
          <span>{data.length}s elapsed</span>
        </div>
      </div>
    </div>
  );
}

function MistakeWordsList({ words }: { words: { expected: string; typed: string }[] }) {
  if (words.length === 0) return null;
  return (
    <div className="mb-8">
      <p className="text-text-sub font-sans text-sm font-semibold mb-3 transition-theme">Missed Words</p>
      <div className="bg-muted rounded-xl p-4 transition-theme max-h-48 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {words.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-card rounded-lg px-3 py-1.5 border border-line transition-theme text-sm font-mono">
              <span className="text-success">{w.expected}</span>
              <span className="text-text-dim">&rarr;</span>
              <span className="text-error">{w.typed}</span>
            </div>
          ))}
        </div>
      </div>
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
  const totalMistakes = safeResult.totalIncorrect;
  const peakWpm = safeResult.wpmHistory.length > 0
    ? Math.max(...safeResult.wpmHistory.map(p => p.wpm))
    : safeResult.wpm;

  return (
    <div className="min-h-screen bg-surface transition-theme">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-display font-bold text-text-main text-center mb-10 transition-theme">
          Test Complete
        </h1>

        <div className="bg-card border border-line rounded-2xl p-6 md:p-8 shadow-sm transition-theme">
          <div className="grid grid-cols-2 gap-8 mb-8">
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
                <WpmBurstChart data={safeResult.wpmHistory} />
              ) : (
                <p className="text-text-dim text-sm font-sans text-center py-8">No data available</p>
              )}
            </div>
          </div>

          <MistakeWordsList words={safeResult.mistakeWords} />

          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-success transition-theme">{safeResult.totalCorrect}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Correct</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-error transition-theme">{totalMistakes}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Mistakes</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{safeResult.duration}s</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Duration</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{grossWpm}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Net WPM (keystrokes / 5)</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center transition-theme">
              <p className="text-lg font-bold font-display text-text-main transition-theme">{peakWpm}</p>
              <p className="text-xs text-text-sub font-sans mt-0.5">Peak WPM</p>
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
