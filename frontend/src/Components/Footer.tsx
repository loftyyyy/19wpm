export default function Footer() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between px-6 md:px-20 py-8 gap-4">
      <p className="text-text-dim text-sm font-display font-semibold transition-theme">
        &copy; 2024 19wpm. Crafted for focused performance.
      </p>
      <div className="flex gap-6 text-text-dim text-sm font-sans transition-theme">
        <a href="#" className="hover:text-text-sub transition-colors">Support</a>
        <a href="#" className="hover:text-text-sub transition-colors">Privacy</a>
        <a href="#" className="hover:text-text-sub transition-colors">Terms</a>
        <a href="#" className="hover:text-text-sub transition-colors">Discord</a>
      </div>
    </div>
  );
}
