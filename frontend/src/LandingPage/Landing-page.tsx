import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import type { Duration, Mode, WordCount, PhraseLength } from '../types';
import English from '../assets/English.svg';
import Type from '../assets/TYPEIMAGE.png';
import Leaf from '../assets/LeafIcon.svg';
import Notebook from '../assets/Notebook.svg';

const durations: Duration[] = [15, 30, 60];
const wordCounts: WordCount[] = [10, 25, 50, 100];
const phraseLengths: PhraseLength[] = ['short', 'medium', 'long', 'thicc', 'all'];
const DURATION_KEY = '19wpm-duration';

function getSavedDuration(): Duration {
  try {
    const saved = localStorage.getItem(DURATION_KEY);
    if (saved === '15' || saved === '60') return parseInt(saved) as Duration;
  } catch {}
  return 30;
}

function buildQuery(mode: Mode, duration: Duration, wordCount: WordCount, phraseLength: PhraseLength): string {
  const params = new URLSearchParams();
  params.set('mode', mode);
  if (mode === 'words') params.set('count', String(wordCount));
  if (mode === 'time') params.set('time', String(duration));
  if (mode === 'phrases') params.set('length', phraseLength);
  return params.toString();
}

const modes: Mode[] = ['words', 'phrases', 'time'];

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('time');
  const [selectedDuration, setSelectedDuration] = useState<Duration>(getSavedDuration);
  const [wordCount, setWordCount] = useState<WordCount>(25);
  const [phraseLength, setPhraseLength] = useState<PhraseLength>('medium');

  const handleDurationChange = (d: Duration) => {
    setSelectedDuration(d);
    localStorage.setItem(DURATION_KEY, String(d));
  };
  const navigate = useNavigate();

  const handleStart = () => {
    navigate(`/solo?${buildQuery(mode, selectedDuration, wordCount, phraseLength)}`);
  };

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center px-4">
        <div className="flex flex-col items-center justify-center mt-20 md:mt-28">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl md:text-6xl font-display font-bold text-text-main transition-theme">
              Type better. Race smarter.
            </h1>
            <span className="w-1 h-8 md:w-1.5 md:h-12 bg-accent rounded-full animate-blink" />
          </div>
          <p className="mt-6 text-sm md:text-base text-text-dim text-center max-w-xl font-sans leading-relaxed transition-theme">
            A refined environment for focused typing practice and calm competition.
            Leave the anxiety behind and find your rhythm.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover transition-colors hover:cursor-pointer shadow-sm"
            >
              Start Typing
            </button>
            <button
              title="Coming soon!"
              disabled
              className="px-8 py-4 border border-line text-text-dim rounded-xl font-sans font-semibold text-sm line-through cursor-not-allowed select-none"
            >
              Join a Race
            </button>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            {/* Group 1 — Mode selector */}
            <div className="flex items-center gap-2 text-xs font-sans">
              {modes.map((m, i) => (
                <span key={m} className="flex items-center gap-2">
                  <button
                    onClick={() => setMode(m)}
                    className={`transition-colors hover:cursor-pointer capitalize ${
                      mode === m ? 'text-accent font-semibold' : 'text-text-dim hover:text-text-sub'
                    }`}
                  >
                    {m}
                  </button>
                  {i < modes.length - 1 && (
                    <span className="text-text-dim/40 font-light">·</span>
                  )}
                </span>
              ))}
            </div>

            {/* Group 2 — Context-sensitive options */}
            {mode === 'phrases' ? (
              <div className="flex items-center gap-2 text-xs font-sans">
                {phraseLengths.map((pl, i) => (
                  <span key={pl} className="flex items-center gap-2">
                    <button
                      onClick={() => setPhraseLength(pl)}
                      className={`transition-colors hover:cursor-pointer capitalize ${
                        phraseLength === pl ? 'text-accent font-semibold' : 'text-text-dim hover:text-text-sub'
                      }`}
                    >
                      {pl}
                    </button>
                    {i < phraseLengths.length - 1 && (
                      <span className="text-text-dim/40 font-light">·</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-sans">
                {(mode === 'time' ? durations : wordCounts).map((v, i, arr) => (
                  <span key={v} className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (mode === 'time') handleDurationChange(v as Duration);
                        else setWordCount(v as WordCount);
                      }}
                      className={`transition-colors hover:cursor-pointer ${
                        (mode === 'time' ? selectedDuration : wordCount) === v
                          ? 'text-accent font-semibold'
                          : 'text-text-dim hover:text-text-sub'
                      }`}
                    >
                      {mode === 'time' ? `${v}` : v}
                    </button>
                    {i < arr.length - 1 && (
                      <span className="text-text-dim/40 font-light">·</span>
                    )}
                  </span>
                ))}
                {mode === 'time' && (
                  <span className="text-text-dim/40 text-[10px]">sec</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 mt-1">
              <img src={English} alt="English" className="w-3 h-3" />
              <span className="text-[11px] text-text-dim font-sans">English</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-12 mt-24 md:mt-32 px-4 md:px-20 max-w-6xl mx-auto">
          <img src={Type} alt="Typing interface preview" className="w-full max-w-lg rounded-xl shadow-lg" />
          <div className="flex flex-col gap-6 max-w-md">
            <h2 className="text-2xl font-display font-semibold text-text-main transition-theme">
              Curated for focus.
            </h2>
            <p className="text-sm text-text-sub font-sans leading-relaxed transition-theme">
              Every element is designed to minimize visual noise. No flashing banners,
              no cluttered dashboards. Just you, the keyboard, and the words.
            </p>
            <div className="flex gap-4 items-start mt-2">
              <img src={Leaf} alt="Calm progression" className="mt-1" />
              <div>
                <h3 className="text-lg font-display font-semibold text-text-main transition-theme">
                  Calm Progression
                </h3>
                <p className="text-sm text-text-sub font-sans mt-1 transition-theme">
                  Track your improvement without the anxiety of aggressive leaderboards.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <img src={Notebook} alt="Editorial texts" className="mt-1" />
              <div>
                <h3 className="text-lg font-display font-semibold text-text-main transition-theme">
                  Editorial Texts
                </h3>
                <p className="text-sm text-text-sub font-sans mt-1 transition-theme">
                  Practice with excerpts from classic literature and thoughtful essays.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <div className="mt-16 md:mt-32">
        <Footer />
      </div>
    </div>
  );
}
