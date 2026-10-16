import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { clearTokens } from '../../services/api';
import { apiExchangeOAuthCode, apiGetSessionUser } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';

export default function OAuth2Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setupFromOAuth } = useAuth();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?oauth_error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!code) {
      navigate('/login?oauth_error=Authentication+failed.+Please+try+again.', { replace: true });
      return;
    }

    // The code is short-lived and single-use — it is exchanged for the token pair
    // over POST so tokens never travel in the browser's URL.
    apiExchangeOAuthCode(code)
      .then(async ({ user, error: exchangeError }) => {
        if (exchangeError || !user) {
          clearTokens();
          navigate('/login?oauth_error=Failed+to+complete+authentication.+Please+try+again.', { replace: true });
          return;
        }
        const profile = await apiGetSessionUser();
        if (profile) {
          await setupFromOAuth(profile);
          navigate('/dashboard', { replace: true });
        } else {
          clearTokens();
          navigate('/login?oauth_error=Failed+to+load+user+profile.', { replace: true });
        }
      })
      .catch(() => {
        clearTokens();
        navigate('/login?oauth_error=Failed+to+complete+authentication.+Please+try+again.', { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen bg-surface transition-theme flex items-center justify-center">
      <p className="text-text-dim font-sans text-sm">Completing authentication...</p>
    </div>
  );
}
