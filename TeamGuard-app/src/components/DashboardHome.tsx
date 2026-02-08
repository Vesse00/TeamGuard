import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle, Clock, Building, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export function DashboardHome() {
  const [stats, setStats] = useState({ total: 0, expired: 0, warning: 0 });
  const [departmentStats, setDepartmentStats] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. SPRAWDZENIE ROLI
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    // Jeśli to zwykły USER -> przekieruj na jego profil
    if (user && user.role !== 'ADMIN') {
        if (user.employeeId) {
            navigate(`/employees/${user.employeeId}`, { replace: true });
        } else {
            navigate('/login');
        }
        return;
    }

    // 2. JEŚLI ADMIN -> POBIERZ STATYSTYKI
    axios.get('http://localhost:3000/api/employees')
      .then(response => {
        const employees = response.data;
        const total = employees.length;
        let expired = 0;
        let warning = 0;

        // Zliczanie działów
        const deptCounts: Record<string, number> = {};

        employees.forEach((emp: any) => {
            const hasExpired = emp.compliance.some((c: any) => c.status === 'EXPIRED');
            const hasWarning = emp.compliance.some((c: any) => c.status === 'WARNING');
            if (hasExpired) expired++;
            else if (hasWarning) warning++;

            // Zliczanie pracowników w działach
            const deptName = emp.department || 'Ogólny';
            deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
        });

        // Konwersja na tablicę i sortowanie (od największego)
        const sortedDepts = Object.entries(deptCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        setStats({ total, expired, warning });
        setDepartmentStats(sortedDepts); // Zapisujemy statystyki działów
        setLoading(false);
      })
      .catch(error => {
        console.error('Błąd pobierania danych:', error);
        setLoading(false);
      });
  }, [navigate]);

  // Jeśli nie admin, nic nie renderuj (czekaj na redirect)
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Pulpit Zarządzania</h1>
        <p className="text-slate-500 mt-2">Przegląd statusu uprawnień pracowników.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* KARTA 1: WSZYSCY */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><Users size={32}/></div>
            <div>
                <p className="text-sm font-bold text-slate-400 uppercase">Wszyscy Pracownicy</p>
                <p className="text-3xl font-bold text-slate-800">{loading ? '...' : stats.total}</p>
            </div>
        </div>

        {/* KARTA 2: WYGASŁE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-xl"><AlertTriangle size={32}/></div>
            <div>
                <p className="text-sm font-bold text-slate-400 uppercase">Wygasłe Uprawnienia</p>
                <p className="text-3xl font-bold text-red-600">{loading ? '...' : stats.expired}</p>
            </div>
        </div>

        {/* KARTA 3: WYGASAJĄCE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-4 bg-orange-50 text-orange-600 rounded-xl"><Clock size={32}/></div>
            <div>
                <p className="text-sm font-bold text-slate-400 uppercase">Wygasają wkrótce</p>
                <p className="text-3xl font-bold text-orange-600">{loading ? '...' : stats.warning}</p>
            </div>
        </div>
      </div>

      {/* --- NOWA SEKCJA: STRUKTURA ZATRUDNIENIA I SZYBKIE AKCJE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* LEWA KOLUMNA: Lista działów (Zajmuje 2/3) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Building size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800">Struktura Zatrudnienia</h3>
              </div>

              {loading ? (
                  <div className="h-32 flex items-center justify-center text-slate-400">Ładowanie danych...</div>
              ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {departmentStats.map((dept) => (
                          <div key={dept.name} className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group">
                              <span className="text-2xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{dept.count}</span>
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center mt-1">{dept.name}</span>
                          </div>
                      ))}
                      {departmentStats.length === 0 && (
                          <div className="col-span-full text-center text-slate-400 py-4">Brak danych o działach</div>
                      )}
                  </div>
              )}
          </div>

          {/* PRAWA KOLUMNA: Szybkie akcje (Zajmuje 1/3) */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-xl">
              <div>
                  <h3 className="text-xl font-bold mb-2">Szybkie Akcje</h3>
                  <p className="text-slate-400 text-sm mb-6">Zarządzaj zespołem i generuj raporty jednym kliknięciem.</p>
                  
                  <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-sm text-slate-300">
                          <CheckCircle size={16} className="text-green-400" /> Dodawanie pracowników
                      </li>
                      <li className="flex items-center gap-2 text-sm text-slate-300">
                          <CheckCircle size={16} className="text-green-400" /> Generowanie raportów
                      </li>
                      <li className="flex items-center gap-2 text-sm text-slate-300">
                          <CheckCircle size={16} className="text-green-400" /> Powiadomienia email
                      </li>
                  </ul>
              </div>
              
              <Link to="/employees" className="mt-8 bg-white text-slate-900 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 group">
                  Przejdź do Listy <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
              </Link>
          </div>
      </div>
    </div>
  );
}