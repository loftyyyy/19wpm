const passageLines = [
  ['w-16', 'w-24', 'w-12', 'w-20', 'w-10'],
  ['w-20', 'w-10', 'w-24', 'w-16', 'w-14', 'w-8'],
  ['w-12', 'w-20', 'w-16', 'w-24', 'w-14'],
];

export function TypingPassageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading passage">
      <span className="sr-only">Loading passage...</span>
      <div aria-hidden="true" className="animate-pulse space-y-3">
        {passageLines.map((line, lineIndex) => (
          <div key={lineIndex} className="flex flex-wrap gap-x-2 gap-y-3">
            {line.map((width, wordIndex) => (
              <span key={wordIndex} className={`h-5 md:h-6 rounded bg-muted ${width}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TypingSkeleton() {
  return (
    <div
      className="min-h-screen bg-surface transition-theme flex flex-col"
      role="status"
      aria-busy="true"
      aria-label="Loading typing test"
    >
      <span className="sr-only">Loading typing test...</span>
      <div aria-hidden="true" className="flex-1 flex flex-col items-center justify-center px-4 max-w-4xl mx-auto w-full">
        <div className="w-full mb-8 flex items-center justify-between">
          <div className="h-3 w-10 rounded bg-muted animate-pulse" />
          <div className="flex items-center gap-6">
            <div className="h-8 w-16 rounded bg-muted animate-pulse" />
            <div className="flex items-center gap-4">
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              <div className="w-px h-4 bg-line" />
              <div className="h-4 w-14 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>

        <div className="w-full h-1.5 bg-muted rounded-full mb-8 animate-pulse" />

        <div className="w-full p-6 rounded-xl bg-card border border-line">
          <TypingPassageSkeleton />
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 animate-pulse">
          <div className="h-3 w-48 rounded bg-muted" />
          <div className="h-8 w-8 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
