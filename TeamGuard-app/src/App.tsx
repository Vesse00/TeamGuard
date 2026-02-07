import { Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

// Komponenty stron
import { LoginPage } from './components/LoginPage';
import { DashboardHome } from './components/DashboardHome';
import { EmployeeList } from './components/EmployeeList';
import { EmployeeDetails } from './components/EmployeeDetails';
import { EditEmployeePage } from './components/EditEmployeePage';
import { SettingsPage } from './components/SettingsPage';
import { ReportsPage } from './components/ReportsPage';
import { CalendarPage } from './components/CalendarPage';
import { LogsPage } from './components/LogsPage';
import { SetPasswordPage } from './components/SetPasswordPage';

// Komponenty nawigacyjne
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

// --- KOMPONENT LAYOUTU (Wspólny wygląd dla zalogowanych) ---
const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
      <Sidebar />
      <main className="ml-64 w-full min-h-screen flex flex-col">
        <Navbar />
        <div className="p-8 flex-1 overflow-hidden">
          {/* Outlet to miejsce, gdzie renderują się podstrony (Dashboard, Employees itd.) */}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      
      <Routes>
        {/* --- TRASY PUBLICZNE --- */}
        <Route path="/login" element={<LoginPage />} />

        {/* --- TRASY CHRONIONE --- */}
        {/* 1. Najpierw sprawdzamy czy jest token (ProtectedRoute) */}
        <Route element={<ProtectedRoute />}>
          
          {/* 2. Jeśli jest token, nakładamy Layout (MainLayout) */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/employees/:id" element={<EmployeeDetails />} />
            <Route path="/employees/:id/edit" element={<EditEmployeePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/set-password" element={<SetPasswordPage />} />
          </Route>

        </Route>

        {/* Fallback dla nieznanych tras - przekieruj na Dashboard (który przekieruje na login jeśli trzeba) */}
        <Route path="*" element={<DashboardHome />} />
      </Routes>
    </>
  );
}

export default App;