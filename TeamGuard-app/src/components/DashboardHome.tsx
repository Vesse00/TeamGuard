import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, AlertTriangle, Clock, ArrowRight } from 'lucide-react';

export function DashboardHome() {
  const [stats, setStats] = useState({ total: 0, expired: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Hook do przekierowania

  useEffect(() => {

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (user && user.role !== 'ADMIN') {
        // Jeśli to nie Admin, wyrzuć go na jego profil
        if (user.employeeId) {
            navigate(`/employees/${user.employeeId}`, { replace: true });
        } else {
            // Sytuacja awaryjna (user bez profilu pracownika)
             navigate('/login'); 
        }
        return;
    }

    axios.get('http://localhost:3000/api/employees')
      .then(response => {
        const data = response.data;
        
        // --- LOGIKA STATYSTYK ---
        let countExpired = 0;
        let countWarning = 0;

        data.forEach((emp: any) => {
          let isPersonExpired = false;
          let isPersonWarning = false;

          emp.compliance.forEach((c: any) => {
            const today = new Date();
            const expiry = new Date(c.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysLeft <= 0) isPersonExpired = true;
            else if (daysLeft > 0 && daysLeft <= 30) isPersonWarning = true;
          });

          if (isPersonExpired) countExpired++;
          else if (isPersonWarning) countWarning++;
        });

        setStats({
          total: data.length,
          expired: countExpired,
          warning: countWarning
        });
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [navigate]);

  // Jeśli przekierowujemy, nie renderuj nic (żeby nie mignęło)
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  if (user?.role !== 'ADMIN') return null;

  if (loading) return <div className="p-10 text-slate-400">Ładowanie statystyk...</div>;

  return (
    <div className="w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Panel Zarządzania</h1>
        <p className="text-slate-500 mt-2">Witaj z powrotem! Oto co dzieje się w Twoim zespole.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Link to="/employees" className="block group h-full">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer h-full flex flex-col justify-between">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Przegląd Zespołu</h2>
                  <p className="text-slate-500 mt-1">Kliknij, aby zarządzać pracownikami i terminami.</p>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <ArrowRight size={24} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-6 border-t border-slate-100">
                <div className="text-center md:text-left">
                  <span className="block text-3xl font-bold text-red-600">{stats.expired}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 justify-center md:justify-start"><AlertTriangle size={12} /> Pilne</span>
                </div>
                <div className="text-center md:text-left border-l border-slate-100 pl-4">
                  <span className="block text-3xl font-bold text-amber-500">{stats.warning}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 justify-center md:justify-start"><Clock size={12} /> Ważne</span>
                </div>
                <div className="text-center md:text-left border-l border-slate-100 pl-4">
                  <span className="block text-3xl font-bold text-slate-700">{stats.total}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 justify-center md:justify-start"><Users size={12} /> Razem</span>
                </div>
              </div>

            </div>
          </Link>
        </div>

        <div className="hidden lg:block bg-slate-100 rounded-2xl border border-slate-200 border-dashed flex items-center justify-center p-8 text-slate-400 font-medium">
            Miejsce na wykres lub kalendarz
        </div>
      </div>
    </div>
  );
}