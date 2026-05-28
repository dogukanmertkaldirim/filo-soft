import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface GuardProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: GuardProps) {
  const { isCustomer, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isCustomer) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}

export function RequireCustomer({ children }: GuardProps) {
  const { isCustomer, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isCustomer) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
