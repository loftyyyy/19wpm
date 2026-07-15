import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userDisplayName } from '../types';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const navLinks: { label: string; path: string; disabled?: boolean }[] = [
    { label: 'Practice', path: '/solo' },
    { label: 'Compete', path: '/race' },
    { label: 'Leaderboard', path: '/leaderboard', disabled: true },
    { label: 'About', path: '/about' },
  ];

  return (
    <nav className="w-full bg-surface transition-theme">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          <Link to="/" className="flex-shrink-0">
            <h1 className="text-nav font-bold text-xl sm:text-2xl font-display transition-theme">
              19wpm
            </h1>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <div className="flex gap-6 text-sm md:text-base text-text-sub font-sans">
              {navLinks.map(link =>
                link.disabled ? (
                  <span
                    key={link.label}
                    title="Coming soon!"
                    className="line-through text-text-dim cursor-not-allowed select-none"
                  >
                    {link.label}
                  </span>
                ) : link.path.startsWith('/') ? (
                  <Link
                    key={link.label}
                    to={link.path}
                    className="hover:text-nav hover:underline hover:underline-offset-4 hover:decoration-nav hover:font-semibold transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.path}
                    className="hover:text-nav hover:underline hover:underline-offset-4 hover:decoration-nav hover:font-semibold transition-colors"
                  >
                    {link.label}
                  </a>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-text-sub hover:bg-muted transition-theme hover:cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white font-sans text-sm font-semibold hover:bg-accent-hover transition-colors hover:cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    {userDisplayName(user!).charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">{userDisplayName(user!)}</span>
                </button>
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-line rounded-lg shadow-lg transition-theme z-50">
                    <div className="py-1">
                      <button
                        onClick={() => { navigate('/dashboard'); setIsProfileOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-muted transition-colors font-sans"
                      >
                        Dashboard
                      </button>
                      <button
                        onClick={() => { logout(); setIsProfileOpen(false); navigate('/'); }}
                        className="w-full text-left px-4 py-2 text-sm text-error hover:bg-muted transition-colors font-sans"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link to="/login" className="px-4 py-2 text-text-sub hover:text-text-main transition-colors font-sans text-sm">
                  Login
                </Link>
                <Link to="/login" className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-sans text-sm font-semibold">
                  Sign Up
                </Link>
              </div>
            )}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-text-sub hover:text-text-main hover:cursor-pointer"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden pb-4 bg-surface transition-theme">
            <div className="flex flex-col gap-3 text-text-sub font-sans">
              {navLinks.map(link =>
                link.disabled ? (
                  <span
                    key={link.label}
                    title="Coming soon!"
                    className="line-through text-text-dim cursor-not-allowed select-none py-2"
                  >
                    {link.label}
                  </span>
                ) : link.path.startsWith('/') ? (
                  <Link
                    key={link.label}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className="hover:text-text-main transition-colors py-2"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className="hover:text-text-main transition-colors py-2"
                  >
                    {link.label}
                  </a>
                )
              )}
              {!isAuthenticated && (
                <div className="flex flex-col gap-3 pt-4 border-t border-line">
                  <Link to="/login" onClick={() => setIsMenuOpen(false)} className="w-full px-4 py-2 text-text-sub border border-line rounded-lg text-center">
                    Login
                  </Link>
                  <Link to="/login" onClick={() => setIsMenuOpen(false)} className="w-full px-4 py-2 bg-accent text-white rounded-lg text-center font-semibold">
                    Sign Up
                  </Link>
                </div>
              )}
              {isAuthenticated && (
                <div className="pt-4 border-t border-line">
                  <button onClick={() => { logout(); setIsMenuOpen(false); navigate('/'); }} className="w-full text-left py-2 text-error font-sans">
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
