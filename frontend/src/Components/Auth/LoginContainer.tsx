import { useState } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export default function LoginContainer() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(searchParams.get('oauth_error') || '');
  const [loading, setLoading] = useState(false);
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'login') {
        if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return; }
        const err = await login(email, password);
        if (err) setError(err);
        else navigate('/dashboard');
      } else {
        if (!username.trim()) { setError('Username is required.'); setLoading(false); return; }
        if (!firstName.trim()) { setError('First name is required.'); setLoading(false); return; }
        if (!lastName.trim()) { setError('Last name is required.'); setLoading(false); return; }
        if (!country.trim()) { setError('Country is required.'); setLoading(false); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return; }
        const err = await register(username, firstName, lastName, email, password, country);
        if (err) setError(err);
        else navigate('/dashboard');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col items-center justify-center px-4">
      <Link to="/" className="mb-2">
        <h1 className="text-4xl font-display font-bold text-nav transition-theme">19wpm</h1>
      </Link>
      <p className="text-text-dim font-sans text-sm mb-10 transition-theme">Crafted for focused performance.</p>

      <div className="w-full max-w-md bg-card border border-line rounded-2xl shadow-sm transition-theme">
        <div className="flex border-b border-line">
          <button
            onClick={() => { setActiveTab('login'); setError(''); window.history.replaceState({}, '', '/login'); }}
            className={`flex-1 py-4 text-sm font-semibold font-sans transition-colors hover:cursor-pointer ${
              activeTab === 'login'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-dim hover:text-text-sub'
            }`}
          >
            LOGIN
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(''); window.history.replaceState({}, '', '/login'); }}
            className={`flex-1 py-4 text-sm font-semibold font-sans transition-colors hover:cursor-pointer ${
              activeTab === 'register'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-dim hover:text-text-sub'
            }`}
          >
            REGISTER
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {activeTab === 'register' && (
            <>
              <div>
                <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Your username"
                  required
                  className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
            />
          </div>

          <div>
            <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={8}
              className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
            />
          </div>

          {activeTab === 'register' && (
            <>
              <div>
                <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="Your country"
                  required
                  className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-error text-sm font-sans text-center transition-theme">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover disabled:opacity-50 transition-colors hover:cursor-pointer"
          >
            {loading ? 'Please wait...' : activeTab === 'login' ? 'Login' : 'Create Account'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-text-dim font-sans transition-theme">or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { window.location.href = `${API_BASE_URL}/oauth2/authorization/google`; }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-line rounded-xl text-sm font-sans text-text-sub hover:bg-muted transition-colors hover:cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = `${API_BASE_URL}/oauth2/authorization/github`; }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-line rounded-xl text-sm font-sans text-text-sub hover:bg-muted transition-colors hover:cursor-pointer"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.82 8.2 11.4.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.1-.75.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.08 1.85 2.83 1.32 3.52 1.01.11-.78.42-1.32.76-1.62-2.66-.3-5.47-1.33-5.47-5.92 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.31 1.24A11.5 11.5 0 0112 5.8c1.02.01 2.05.14 3.01.41 2.3-1.56 3.31-1.24 3.31-1.24.66 1.65.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.6-2.82 5.62-5.5 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58C20.57 21.81 24 17.3 24 12 24 5.37 18.63 0 12 0z" />
              </svg>
              GitHub
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
