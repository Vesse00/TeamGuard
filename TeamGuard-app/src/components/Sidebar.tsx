import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, LifeBuoy, BarChart, ChevronDown, ChevronRight, MoreHorizontal, History } from 'lucide-react';

export function Sidebar() {
  const location = useLocation();
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) setUser(JSON.parse(userStr));
  }, []);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const baseLink = "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium";
  const activeLink = "bg-blue-600 text-white shadow-md";
  const inactiveLink = "text-slate-400 hover:bg-slate-800 hover:text-white";
  const getLinkClass = (path: string) => `${baseLink} ${isActive(path) ? activeLink : inactiveLink}`;

  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="h-16 flex items-center px-6 border-b border-slate-800"><span className="text-white font-bold text-xl">Team<span className="text-blue-500">Guard</span></span></div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
        
        {/* WSPÓLNE */}
        <Link to="/" className={getLinkClass('/')}><LayoutDashboard size={20} /> Pulpit</Link>

        {/* TYLKO ADMIN */}
        {isAdmin && (
            <>
                <Link to="/employees" className={getLinkClass('/employees')}><Users size={20} /> Pracownicy</Link>
                <Link to="/calendar" className={getLinkClass('/calendar')}><Calendar size={20} /> Kalendarz</Link>
            </>
        )}

        {/* TYLKO ZWYKŁY USER */}
        {!isAdmin && user?.employeeId && (
            <Link to={`/employees/${user.employeeId}`} className={getLinkClass(`/employees/${user.employeeId}`)}>
                <Users size={20} /> Mój Profil
            </Link>
        )}

        {/* SEKCJA INNE (Tylko Admin) */}
        {isAdmin && (
            <div className="pt-2">
                <button onClick={() => setIsOtherOpen(!isOtherOpen)} className={`w-full flex items-center justify-between ${baseLink} ${isOtherOpen ? 'bg-slate-800 text-white' : inactiveLink}`}>
                    <div className="flex items-center gap-3"><MoreHorizontal size={20} /><span>Inne</span></div>
                    {isOtherOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isOtherOpen && (
                    <div className="mt-1 ml-4 border-l border-slate-700 pl-2 space-y-1">
                        <Link to="/reports" className={getLinkClass('/reports')}><BarChart size={18} /> Raporty</Link>
                        <Link to="/logs" className={getLinkClass('/logs')}><History size={18} /> Historia Zmian</Link>
                    </div>
                )}
            </div>
        )}
      </nav>
      
      <div className="p-3 border-t border-slate-800 bg-slate-900">
        <Link to="/help" className={getLinkClass('/help')}><LifeBuoy size={20} /> Pomoc</Link>
      </div>
    </aside>
  );
}