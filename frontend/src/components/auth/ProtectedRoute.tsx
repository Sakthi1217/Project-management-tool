import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (roles && user && !roles.includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
