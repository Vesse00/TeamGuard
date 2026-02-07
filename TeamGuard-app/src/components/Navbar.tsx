import { useState, useEffect, useRef } from 'react';
import { Bell, Search, Settings, LogOut, ChevronDown, X, ChevronRight, User, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Notification {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// Interfejs dla wyników wyszukiwania
interface SearchResult {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  avatarInitials: string;
}

export function Navbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const navigate = useNavigate();
  
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // --- STANY WYSZUKIWARKI ---
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // --- LOGIKA POWIADOMIEŃ ---
  const fetchNotifications = async (userId: number) => {
      try {
          const res = await axios.get(`http://localhost:3000/api/notifications?userId=${userId}`);
          if(res.data) {
             setNotifications(res.data);
          }
      } catch (err) { 
          console.error("Błąd pobierania powiadomień:", err); 
      }
  };

  const loadUserAndNotifs = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const parsedUser = JSON.parse(userStr);
        setUser(parsedUser);
        fetchNotifications(parsedUser.id);
      }
  };

  useEffect(() => {
    loadUserAndNotifs();
    const intervalId = setInterval(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const parsedUser = JSON.parse(userStr);
            fetchNotifications(parsedUser.id);
        }
    }, 5000); 
    return () => clearInterval(intervalId);
  }, []);

  // --- LOGIKA WYSZUKIWARKI ---
  
  // Zamykanie listy po kliknięciu poza nią
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
        setResults([]);
        setIsSearchOpen(false);
        return;
    }

    try {
        const res = await axios.get(`http://localhost:3000/api/employees?search=${text}`);
        setResults(res.data);
        setIsSearchOpen(true);
    } catch (error) {
        console.error("Błąd szukania", error);
    }
  };

  const handleSelectResult = (employeeId: number) => {
      navigate(`/employees/${employeeId}`);
      setQuery('');
      setIsSearchOpen(false);
  };

  // --- POZOSTAŁE FUNKCJE ---

  const markAsRead = async (notif: Notification) => {
      try {
          await axios.put(`http://localhost:3000/api/notifications/${notif.id}/read`);
          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
          
          if (notif.link) {
              navigate(notif.link);
              setIsNotifOpen(false);
          }
      } catch (err) { console.error(err); }
  };

  // --- NOWOŚĆ: Oznacz WSZYSTKIE jako przeczytane ---
  const markAllAsRead = async () => {
      if (!user) return;
      try {
          await axios.put('http://localhost:3000/api/notifications/read-all', { userId: user.id });
          
          // Aktualizacja lokalna (optymistyczna)
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
          toast.success("Wszystkie powiadomienia oznaczone jako przeczytane");
      } catch (err) {
          console.error(err);
          toast.error("Błąd aktualizacji powiadomień");
      }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsDropdownOpen(false);
    toast.success('Wylogowano pomyślnie');
    navigate('/login');
  };

  const getInitials = () => {
      if (!user) return 'U';
      return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <nav className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
      
      {/* --- WYSZUKIWARKA --- */}
      <div className="relative w-96" ref={searchRef}>
        <div className="relative group">
            <input 
              type="text" 
              placeholder="Szukaj pracownika..." 
              className="w-full h-11 pl-11 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700 placeholder:text-slate-400"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => query.length >= 2 && setIsSearchOpen(true)}
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            
            {query && (
                <button 
                    onClick={() => { setQuery(''); setIsSearchOpen(false); }} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                    <X size={16} />
                </button>
            )}
        </div>

        {/* LISTA WYNIKÓW (DROPDOWN) */}
        {isSearchOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-2 duration-200 z-50">
                {results.length > 0 ? (
                    <div className="py-2">
                        <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Znaleziono</div>
                        {results.slice(0, 5).map((emp) => (
                            <div 
                                key={emp.id} 
                                onClick={() => handleSelectResult(emp.id)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between group transition-colors border-b border-slate-50 last:border-0"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-200">
                                        {emp.avatarInitials || <User size={14}/>}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                                            {emp.firstName} {emp.lastName}
                                        </p>
                                        <p className="text-xs text-slate-400">{emp.position}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-400" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 text-center text-sm text-slate-500">
                        Nie znaleziono: "<strong>{query}</strong>"
                    </div>
                )}
            </div>
        )}
      </div>

      {/* --- PRAWA STRONA --- */}
      <div className="flex items-center gap-6">
        
        {/* POWIADOMIENIA */}
        <div className="relative">
            <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2 rounded-xl transition-colors ${isNotifOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                )}
            </button>

            {isNotifOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* NAGŁÓWEK POWIADOMIEŃ */}
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-700">Powiadomienia</span>
                                {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>}
                            </div>
                            
                            {/* PRZYCISK ODCZYTAJ WSZYSTKIE */}
                            {unreadCount > 0 && (
                                <button 
                                    onClick={markAllAsRead} 
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                                    title="Oznacz wszystkie jako przeczytane"
                                >
                                    <CheckCheck size={12} /> Odczytaj
                                </button>
                            )}
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-sm">Brak nowych powiadomień</div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif.id} 
                                        onClick={() => markAsRead(notif)}
                                        className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!notif.isRead ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                            <div>
                                                <p className={`text-sm ${!notif.isRead ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{notif.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-2">
                                                    {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>

        <div className="h-8 w-px bg-slate-200"></div>

        {/* PROFIL USERA */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 pr-3 rounded-xl transition-all border border-transparent hover:border-slate-100"
          >
            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
              {getInitials()}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-bold text-slate-700 leading-tight">{user?.firstName || 'User'}</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Administrator</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-sm font-bold text-slate-800">Zalogowano jako</p>
                    <p className="text-xs text-slate-500 truncate font-medium">{user?.email}</p>
                </div>
                <div className="p-2 border-b border-slate-100">
                    <Link 
                        to="/settings" 
                        onClick={() => setIsDropdownOpen(false)} 
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-left"
                    >
                        <Settings size={18} className="text-slate-400"/> Ustawienia
                    </Link>
                </div>
                <div className="p-2">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl text-left">
                        <LogOut size={18} className="text-red-500"/> Wyloguj się
                    </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}