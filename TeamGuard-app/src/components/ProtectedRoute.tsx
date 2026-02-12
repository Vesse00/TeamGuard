import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode; // Zmieniono z JSX.Element na ReactNode (standard dla props.children)
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const userStr = localStorage.getItem('user');
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userStr);

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Jeśli user to USER, a wymaga ADMINA -> przekieruj na jego profil
    if (user.role === 'USER' && user.employeeId) {
        return <Navigate to={`/employees/${user.employeeId}`} replace />;
    }
    // Fallback -> Login lub Dashboard
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}