import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
        <h1 className="text-3xl font-display font-bold text-text-main text-center mb-2 transition-theme">About 19wpm</h1>
        <p className="text-text-dim font-sans text-sm text-center mb-12 transition-theme">A typing test built for focus, not flash.</p>

        <div className="space-y-8">
          <section className="bg-card border border-line rounded-2xl p-6 transition-theme">
            <h2 className="text-xl font-display font-semibold text-text-main mb-3 transition-theme">The Idea</h2>
            <p className="text-sm text-text-sub font-sans leading-relaxed transition-theme">
              Most typing tests overwhelm you with leaderboards, flashing badges, and performance anxiety.
              19wpm strips all of that away. It&apos;s just you, a clean interface, and a well-chosen passage.
              The goal is deliberate practice, not competitive stress.
            </p>
          </section>

          <section className="bg-card border border-line rounded-2xl p-6 transition-theme">
            <h2 className="text-xl font-display font-semibold text-text-main mb-3 transition-theme">Features</h2>
            <ul className="space-y-3 text-sm font-sans">
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5 shrink-0">&rarr;</span>
                <span className="text-text-sub leading-relaxed"><strong className="text-text-main">Timed tests</strong> &mdash; 15, 30, or 60-second sprints with live WPM and accuracy tracking.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5 shrink-0">&rarr;</span>
                <span className="text-text-sub leading-relaxed"><strong className="text-text-main">Curated passages</strong> &mdash; Excerpts from literature and essays, with custom passage support.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5 shrink-0">&rarr;</span>
                <span className="text-text-sub leading-relaxed"><strong className="text-text-main">Detailed results</strong> &mdash; WPM burst chart, mistake analysis, and character-level breakdown.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5 shrink-0">&rarr;</span>
                <span className="text-text-sub leading-relaxed"><strong className="text-text-main">Dashboard</strong> &mdash; Track your progression with charts and searchable history.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent mt-0.5 shrink-0">&rarr;</span>
                <span className="text-text-sub leading-relaxed"><strong className="text-text-main">Themes</strong> &mdash; Cozy Light and Dracula Dark with smooth transitions.</span>
              </li>
            </ul>
          </section>

          <section className="bg-card border border-line rounded-2xl p-6 transition-theme">
            <h2 className="text-xl font-display font-semibold text-text-main mb-3 transition-theme">Keyboard Shortcuts</h2>
            <div className="space-y-2 text-sm font-sans">
              <div className="flex justify-between py-1.5 border-b border-line">
                <span className="text-text-sub">Restart test</span>
                <kbd className="px-2 py-0.5 bg-muted border border-line rounded text-xs font-mono text-text-main">Esc</kbd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line">
                <span className="text-text-sub">Delete previous word</span>
                <kbd className="px-2 py-0.5 bg-muted border border-line rounded text-xs font-mono text-text-main">Ctrl+Backspace</kbd>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-sub">Delete previous character</span>
                <kbd className="px-2 py-0.5 bg-muted border border-line rounded text-xs font-mono text-text-main">Backspace</kbd>
              </div>
            </div>
          </section>

          <section className="bg-card border border-line rounded-2xl p-6 transition-theme">
            <h2 className="text-xl font-display font-semibold text-text-main mb-3 transition-theme">Tech Stack</h2>
            <p className="text-sm text-text-sub font-sans leading-relaxed transition-theme">
              Built with React, TypeScript, Tailwind CSS v4, and Vite. Charts powered by recharts. State management
              via React hooks and context. Planned Spring Boot backend for authentication, multiplayer races, and global leaderboards.
            </p>
          </section>

          <div className="text-center pt-4">
            <button
              onClick={() => navigate('/solo')}
              className="px-8 py-3 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover transition-colors hover:cursor-pointer"
            >
              Start Typing
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
