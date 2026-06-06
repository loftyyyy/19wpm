import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setTokens, clearTokens } from '../../services/api';
import { apiGetSessionUser } from '../../services/auth';

export default function OAuth2Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?oauth_error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!accessToken || !refreshToken) {
      navigate('/login?oauth_error=Authentication+failed.+Please+try+again.', { replace: true });
      return;
    }

    setTokens(accessToken, refreshToken);

    apiGetSessionUser().then(user => {
      if (user) {
        localStorage.setItem('19wpm-session', JSON.stringify(user));
        navigate('/dashboard', { replace: true });
      } else {
        clearTokens();
        navigate('/login?oauth_error=Failed+to+load+user+profile.', { replace: true });
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface transition-theme flex items-center justify-center">
      <p className="text-text-dim font-sans text-sm">Completing authentication...</p>
    </div>
  );
}
