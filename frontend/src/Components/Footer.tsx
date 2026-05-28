export default function Footer() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between px-6 md:px-20 py-8 gap-4">
      <p className="text-text-dim text-sm font-display font-semibold transition-theme">
        &copy; 2024 19wpm. Crafted for focused performance.
      </p>
      <div className="flex gap-6 text-text-dim text-sm font-sans transition-theme">
        <a href="https://github.com/anomalyco/opencode/issues" target="_blank" rel="noopener noreferrer" className="hover:text-text-sub transition-colors">GitHub</a>
        <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer" className="hover:text-text-sub transition-colors">Docs</a>
        <a href="/about" className="hover:text-text-sub transition-colors">About</a>
        <a href="/leaderboard" className="hover:text-text-sub transition-colors">Leaderboard</a>
      </div>
    </div>
  );
}
