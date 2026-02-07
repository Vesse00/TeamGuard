import { Navigate, Outlet } from 'react-router-dom';

export function ProtectedRoute() {
  const token = localStorage.getItem('token');

  // Jeśli nie ma tokena, przekieruj na login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Jeśli jest, pozwól wejść głębiej (renderuj dzieci - Outlet)
  return <Outlet />;
}