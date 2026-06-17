export default function Footer() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between px-6 md:px-20 py-8 gap-4">
      <p className="text-text-dim text-sm font-display font-semibold transition-theme">
        &copy; 2026 19wpm. Crafted for focused performance.
      </p>
      <div className="flex gap-6 text-text-dim text-sm font-sans transition-theme">
        <a href="https://github.com/loftyyyy/19wpm" target="_blank" rel="noopener noreferrer" className="hover:text-text-sub transition-colors">GitHub</a>
        <a href="https://github.com/loftyyyy/19wpm" target="_blank" rel="noopener noreferrer" className="hover:text-text-sub transition-colors">Docs</a>
        <a href="/about" className="hover:text-text-sub transition-colors">About</a>
        <span title="Coming soon!" className="line-through cursor-not-allowed select-none">Leaderboard</span>
      </div>
    </div>
  );
}
