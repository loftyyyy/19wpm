import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { TestResult } from '../../types';

const ITEMS_PER_PAGE = 10;

export default function RecentHistory() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { getResults } = useAuth();
  const results = useMemo(() => getResults?.() ?? [], [getResults]);

  const filtered = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.toLowerCase();
    return results.filter(
      (r: TestResult) =>
        r.passage.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q)
    );
  }, [results, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(0, page * ITEMS_PER_PAGE);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="px-4 md:px-20 py-8">
      <div className="bg-card border border-line rounded-2xl shadow-sm p-6 transition-theme">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-display font-semibold text-text-main transition-theme">History</h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search passages..."
              className="pl-9 pr-4 py-2 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 w-56 transition-theme"
            />
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="py-12 text-center text-text-dim font-sans text-sm transition-theme">
            {search ? 'No results match your search.' : 'No test history yet. Complete a test to see it here.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="pb-3 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">Text</th>
                    <th className="pb-3 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">WPM</th>
                    <th className="pb-3 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">Accuracy</th>
                    <th className="pb-3 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">Duration</th>
                    <th className="pb-3 text-xs font-semibold text-text-dim font-sans uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r: TestResult) => (
                    <tr key={r.id} className="border-b border-line hover:bg-muted transition-colors">
                      <td className="py-4 text-sm font-sans text-text-main">
                        <div className="font-medium">
                          {r.passage.length > 50 ? r.passage.slice(0, 50) + '...' : r.passage}
                        </div>
                        <div className="text-xs text-text-sub mt-0.5">{r.author} &middot; {r.source}</div>
                      </td>
                      <td className="py-4 text-sm font-semibold font-sans text-accent">{r.wpm}</td>
                      <td className="py-4 text-sm font-sans text-text-sub">{r.accuracy}%</td>
                      <td className="py-4 text-sm font-sans text-text-sub">{formatDuration(r.duration)}</td>
                      <td className="py-4 text-sm font-sans text-text-sub">{formatDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
                <span className="text-xs text-text-dim font-sans">
                  Showing {paginated.length} of {filtered.length}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 text-sm font-sans font-semibold text-accent hover:bg-muted rounded-xl disabled:opacity-30 transition-colors hover:cursor-pointer"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
