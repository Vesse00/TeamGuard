import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardHome } from './components/DashboardHome';
import { EmployeeList } from './components/EmployeeList';
import { SchedulePage } from './components/SchedulePage';
import { LoginPage } from './components/LoginPage';
import { EmployeeDetails } from './components/EmployeeDetails';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CalendarPage } from './components/CalendarPage';
import { EditEmployeePage } from './components/EditEmployeePage';
import { DepartmentsPage } from './components/DepartmentsPage';
import { ReportsPage } from './components/ReportsPage';
import { LogsPage } from './components/LogsPage';
import { SettingsPage } from './components/SettingsPage';
import { HelpPage } from './components/HelpPage'; // Upewnij się, że masz ten plik (stworzyliśmy go wcześniej)
import { UserSchedulePage } from './components/UserSchedulePage';
import { Toaster } from 'sonner';

// --- KOMPONENT LAYOUT (RAMA APLIKACJI) ---
// Zawiera pasek boczny i górny. Używany dla zalogowanych stron.
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex bg-slate-50 min-h-screen font-sans text-slate-900">
      <Sidebar />
      <div className="flex-1 ml-64 transition-all duration-300">
        <Navbar />
        <main className="p-8 mt-16">
          {children}
        </main>
      </div>
    </div>
  );
};

// --- KOMPONENT PRZEKIEROWANIA (HOME) ---
// Decyduje, gdzie wysłać użytkownika po wejściu na "/"
const HomeRedirect = () => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (!user) return <Navigate to="/login" replace />;

  // 1. Jeśli to ADMIN -> Pokaż Dashboard Zarządczy
  if (user.role === 'ADMIN') {
      return <DashboardHome />;
  }

  // 2. Jeśli to PRACOWNIK -> Przekieruj na jego profil
  /*if (user.role === 'USER' && user.employeeId) {
      return <Navigate to={`/employees/${user.employeeId}`} replace />;
  }*/

  // Fallback (np. user techniczny bez profilu)
  return <div className="p-10 text-center text-slate-500">Brak przypisanego profilu pracownika.</div>;
};

function App() {
  return (
    <Router>
      <Toaster position="top-center" richColors closeButton />
      <Routes>
        {/* LOGOWANIE (Bez Layoutu) */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* --- STRONA GŁÓWNA (Inteligentne przekierowanie) --- */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
               <HomeRedirect />
            </Layout>
          </ProtectedRoute>
        } />

        {/* --- STRONY DLA WSZYSTKICH (User + Admin) --- */}
        <Route path="/help" element={
          <ProtectedRoute>
            <Layout><HelpPage /></Layout>
          </ProtectedRoute>
        } />
        
        
        {/* SZCZEGÓŁY PRACOWNIKA */}
        {/* Dostępne dla każdego, ale w środku EmployeeDetails jest zabezpieczenie, 
            żeby User nie widział cudzego profilu */}
        <Route path="/employees/:id" element={
          <ProtectedRoute>
            <Layout><EmployeeDetails /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/userSchedule" element={
          <ProtectedRoute allowedRoles={["USER"]}>
            <Layout>
              <UserSchedulePage/>
            </Layout>
          </ProtectedRoute>
        } />

        {/* --- STREFY TYLKO DLA ADMINA (Protected z allowedRoles) --- */}
        
        <Route path="/employees" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Layout><EmployeeList /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/schedule" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Layout><SchedulePage /></Layout>
          </ProtectedRoute>
          
        } />

        <Route path="/employees/:id/edit" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Layout><EditEmployeePage /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/calendar" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Layout><CalendarPage /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/departments" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
             <Layout><DepartmentsPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
             <Layout><ReportsPage /></Layout>
          </ProtectedRoute>
        } />

         <Route path="/logs" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
             <Layout><LogsPage /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
             <Layout><SettingsPage /></Layout>
          </ProtectedRoute>
        } />

        {/* CATCH ALL - Przekieruj na główną */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;