import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import type { Duration } from '../types';
import English from '../assets/English.svg';
import Type from '../assets/TYPEIMAGE.png';
import Leaf from '../assets/LeafIcon.svg';
import Notebook from '../assets/Notebook.svg';

const durations: Duration[] = [15, 30, 60];

export default function LandingPage() {
  const [selectedDuration, setSelectedDuration] = useState<Duration>(30);
  const navigate = useNavigate();

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
              onClick={() => navigate(`/solo?time=${selectedDuration}`)}
              className="px-8 py-4 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover transition-colors hover:cursor-pointer shadow-sm"
            >
              Start Typing
            </button>
            <button
              onClick={() => navigate(`/solo?time=${selectedDuration}`)}
              className="px-8 py-4 border border-accent text-accent rounded-xl font-sans font-semibold text-sm hover:bg-muted transition-colors hover:cursor-pointer"
            >
              Join a Race
            </button>
          </div>

          <div className="mt-10 flex items-center justify-center gap-4">
            <div className="bg-muted flex items-center justify-center p-1 gap-1 rounded-2xl shadow-sm transition-theme">
              {durations.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDuration(d)}
                  className={`px-4 py-2 text-sm font-semibold font-sans rounded-xl transition-all hover:cursor-pointer ${
                    selectedDuration === d
                      ? 'bg-accent text-white'
                      : 'text-text-sub hover:text-text-main'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-line transition-theme" />
            <div className="bg-muted flex items-center justify-center gap-2 rounded-2xl px-4 py-2 shadow-sm transition-theme hover:cursor-pointer">
              <img src={English} alt="English" className="w-4 h-4" />
              <span className="text-sm text-text-sub font-semibold font-sans">English</span>
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
