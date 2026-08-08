export default function PageFallback() {
  return (
    <div className="min-h-screen bg-surface transition-theme flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-text-dim font-sans text-sm">Loading...</p>
      </div>
    </div>
  );
}
