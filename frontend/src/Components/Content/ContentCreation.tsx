import { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { useAuth } from '../../context/AuthContext';
import { apiSaveCustomText } from '../../services/passages';

interface CustomPassage {
  id: string;
  title: string;
  text: string;
  author: string;
  source: string;
}

export default function ContentCreation() {
  const [title, setTitle] = useState('');
  const [passage, setPassage] = useState('');
  const [author, setAuthor] = useState('');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const customPassages = useMemo((): CustomPassage[] => {
    try {
      return JSON.parse(localStorage.getItem('19wpm-custom-passages') || '[]');
    } catch {
      return [];
    }
  }, [message]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const wordCount = passage.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 20) {
      setMessage({ type: 'error', text: `Minimum 20 words required. Currently ${wordCount} words.` });
      return;
    }

    const existing: CustomPassage[] = JSON.parse(localStorage.getItem('19wpm-custom-passages') || '[]');
    existing.push({
      id: Date.now().toString(),
      title: title.trim() || 'Untitled',
      text: passage.trim(),
      author: author.trim() || 'Anonymous',
      source: source.trim() || 'Custom Submission',
    });
    localStorage.setItem('19wpm-custom-passages', JSON.stringify(existing));

    // Also persist to the backend
    const { error } = await apiSaveCustomText({
      title: title.trim() || 'Untitled',
      author: author.trim() || 'Anonymous',
      source: source.trim() || 'Custom Submission',
      language: 'en',
      content: passage.trim(),
    });

    setMessage({ type: error ? 'error' : 'success', text: error || 'Passage submitted!' });
    if (!error) {
      setTitle('');
      setPassage('');
      setAuthor('');
      setSource('');
    }
  };

  const handleDelete = (id: string) => {
    const existing: CustomPassage[] = JSON.parse(localStorage.getItem('19wpm-custom-passages') || '[]');
    const filtered = existing.filter(p => p.id !== id);
    localStorage.setItem('19wpm-custom-passages', JSON.stringify(filtered));
    setMessage({ type: 'success', text: 'Passage deleted.' });
  };

  const handleUsePassage = (p: CustomPassage) => {
    localStorage.setItem('19wpm-custom-passage', JSON.stringify(p));
    navigate('/solo?custom=1');
  };

  const wordCount = passage.trim() ? passage.trim().split(/\s+/).filter(Boolean).length : 0;
  const isValid = wordCount >= 20;

  return (
    <div className="min-h-screen bg-surface transition-theme flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-12 w-full">
        <h1 className="text-3xl font-display font-bold text-text-main text-center mb-2 transition-theme">
          Create a Passage
        </h1>
        <p className="text-text-dim font-sans text-sm text-center mb-10 transition-theme">
          Submit a custom text for the typing test library.
        </p>

        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-2xl p-6 shadow-sm space-y-5 mb-10 transition-theme">
          <div>
            <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="A memorable title for this passage"
              className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
            />
          </div>

          <div>
            <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">
              Passage <span className="text-error">*</span>
            </label>
            <textarea
              value={passage}
              onChange={e => setPassage(e.target.value)}
              placeholder="Paste or type your passage here (minimum 20 words)..."
              rows={6}
              className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs font-sans ${isValid ? 'text-success' : 'text-error'} transition-theme`}>
                {wordCount > 0 ? `${wordCount} words` : 'No words yet'}
                {!isValid && wordCount > 0 && ` (need ${20 - wordCount} more)`}
              </span>
              {isValid && <span className="text-xs text-success font-sans">Minimum met</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Author</label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-text-sub mb-1.5 transition-theme">Source</label>
              <input
                type="text"
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="Book or article title"
                className="w-full px-4 py-2.5 bg-muted border border-line rounded-xl text-sm font-sans text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-theme"
              />
            </div>
          </div>

          {message && (
            <p className={`text-sm font-sans text-center ${message.type === 'error' ? 'text-error' : 'text-success'} transition-theme`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full py-3 bg-accent text-white rounded-xl font-sans font-semibold text-sm hover:bg-accent-hover disabled:opacity-40 transition-colors hover:cursor-pointer"
          >
            Submit Passage
          </button>
        </form>

        {customPassages.length > 0 && (
          <div className="bg-card border border-line rounded-2xl p-6 shadow-sm transition-theme">
            <h2 className="text-lg font-display font-semibold text-text-main mb-4 transition-theme">
              Your Passages ({customPassages.length})
            </h2>
            <div className="space-y-3">
              {customPassages.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-muted rounded-xl transition-theme">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-semibold font-sans text-text-main truncate transition-theme">{p.title}</p>
                    <p className="text-xs text-text-sub font-sans mt-0.5 transition-theme">
                      {p.author} &middot; {p.source} &middot; {p.text.split(/\s+/).length} words
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleUsePassage(p)}
                      className="px-3 py-1.5 text-xs font-sans font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors hover:cursor-pointer"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-3 py-1.5 text-xs font-sans font-semibold text-error border border-error rounded-lg hover:bg-error/10 transition-colors hover:cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
