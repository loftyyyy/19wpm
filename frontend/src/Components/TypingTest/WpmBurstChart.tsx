import { useState, useRef, useEffect, useMemo } from 'react';
import type { WpmPoint } from '../../types';

const CHART_HEIGHT = 180;
const BAR_AREA_HEIGHT = 140;
const ERROR_DOT_Y = 16;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 16;
const PEAK_BADGE_WIDTH = 80;
const INNER_RIGHT = PADDING_RIGHT + PEAK_BADGE_WIDTH + 8;

export default function WpmBurstChart({ data }: { data: WpmPoint[] }) {
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
