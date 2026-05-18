import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error === 'google_cancelled' || error === 'keycloak_cancelled') {
      navigate('/login', { replace: true });
      return;
    }

    if (error || !token) {
      toast.error('Failed to complete sign in');
      navigate('/login', { replace: true });
      return;
    }

    loginWithToken(token)
      .then(() => {
        toast.success('Welcome');
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        toast.error('Could not complete sign in');
        navigate('/login', { replace: true });
      });
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
        <div className="p-3 bg-primary-500 rounded-xl">
          <BarChart3 className="w-8 h-8 text-white" />
        </div>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
        <p className="text-gray-500 text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
