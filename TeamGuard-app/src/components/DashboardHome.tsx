import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export function DashboardHome() {
  const [stats, setStats] = useState({ total: 0, expired: 0, warning: 0 });
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

        employees.forEach((emp: any) => {
            const hasExpired = emp.compliance.some((c: any) => c.status === 'EXPIRED');
            const hasWarning = emp.compliance.some((c: any) => c.status === 'WARNING');
            if (hasExpired) expired++;
            else if (hasWarning) warning++;
        });

        setStats({ total, expired, warning });
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

      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl flex justify-between items-center">
          <div>
              <h2 className="text-2xl font-bold mb-2">Wszystko pod kontrolą?</h2>
              <p className="text-blue-100">Sprawdź szczegółową listę pracowników lub wygeneruj raport.</p>
          </div>
          <Link to="/employees" className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg">
              Przejdź do listy
          </Link>
      </div>
    </div>
  );
}