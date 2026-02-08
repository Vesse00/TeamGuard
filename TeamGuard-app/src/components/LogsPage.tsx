import { useEffect, useState } from 'react';
import axios from 'axios';
import { History, UserPlus, Trash2, Edit, RefreshCw, ArrowRight, Clock, Search, X, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface LogEntry {
  id: number;
  action: string;
  details: string;
  performedBy: string;
  targetId: number | null;
  createdAt: string;
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stan wyszukiwarki
  const [query, setQuery] = useState('');
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filtrowanie na żywo
  useEffect(() => {
    if (!query) {
        setFilteredLogs(logs);
    } else {
        const lowerQ = query.toLowerCase();
        const filtered = logs.filter(log => 
            log.details.toLowerCase().includes(lowerQ) || 
            log.performedBy.toLowerCase().includes(lowerQ) ||
            log.action.toLowerCase().includes(lowerQ)
        );
        setFilteredLogs(filtered);
    }
  }, [query, logs]);

  const fetchLogs = () => {
    setLoading(true);
    axios.get('http://localhost:3000/api/logs')
      .then(res => {
        setLogs(res.data);
        setFilteredLogs(res.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Nie udało się pobrać historii.');
        setLoading(false);
      });
  };

  const getActionStyle = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('nowy pracownik')) return { icon: <UserPlus size={20}/>, bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' };
    if (lower.includes('nowe uprawnienie')) return { icon: <UserPlus size={20}/>, bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' };
    if (lower.includes('usunięcie uprawnienia') || lower.includes('usunięcie pracownika')) return { icon: <Trash2 size={20}/>, bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
    if (lower.includes('usuń') || lower.includes('usunięto')) return { icon: <Trash2 size={20}/>, bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
    if (lower.includes('odnowienie')) return { icon: <RefreshCw size={20}/>, bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
    if (lower.includes('edycja') || lower.includes('aktualizacja')) return { icon: <Edit size={20}/>, bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' };
    
    return { icon: <History size={20}/>, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      
      {/* NAGŁÓWEK Z WYSZUKIWARKĄ */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm">
                <History size={32} />
            </div>
            <div>
            <h1 className="text-3xl font-bold text-slate-800">Historia Zmian</h1>
            <p className="text-slate-500">Pełny rejestr działań administratorów w systemie.</p>
            </div>
        </div>

        {/* WYSZUKIWARKA (Styl z Navbar.tsx) */}
        <div className="relative w-full md:w-80 group">
            <input 
              type="text" 
              placeholder="Szukaj pracownika, akcji..." 
              className="w-full h-11 pl-11 pr-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700 placeholder:text-slate-400 shadow-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            
            {query && (
                <button 
                    onClick={() => setQuery('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <X size={16} />
                </button>
            )}
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        
        {/* FILTRY INFO (Tylko gdy coś wyszukujemy) */}
        {query && (
            <div className="bg-slate-50/50 px-6 py-3 border-b border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <Filter size={12}/> Znaleziono {filteredLogs.length} wpisów dla "{query}"
            </div>
        )}

        {loading ? (
           <div className="p-10 text-center text-slate-400 animate-pulse">Ładowanie historii...</div>
        ) : filteredLogs.length === 0 ? (
           <div className="p-12 text-center">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                   <Search size={32}/>
               </div>
               <p className="text-slate-500 font-medium">Brak wyników wyszukiwania.</p>
               {query && <button onClick={() => setQuery('')} className="mt-2 text-blue-600 text-sm font-bold hover:underline">Wyczyść filtry</button>}
           </div>
        ) : (
           <div className="divide-y divide-slate-100">
             {filteredLogs.map((log) => {
               const style = getActionStyle(log.action);
               return (
                 <div key={log.id} className="p-6 hover:bg-slate-50/80 transition-colors group flex flex-col md:flex-row gap-4 items-start md:items-center">
                    
                    {/* Ikona */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${style.bg} ${style.text} ${style.border}`}>
                        {style.icon}
                    </div>

                    {/* Treść */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                                {log.action}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock size={12}/> {formatDate(log.createdAt)}
                            </span>
                        </div>
                        <p className="text-slate-800 font-medium text-sm leading-relaxed">
                            <span className="font-bold text-slate-900">{log.performedBy}:</span> {log.details}
                        </p>
                    </div>

                    {/* Przycisk akcji (jeśli dotyczy pracownika) */}
                    {log.targetId && (
                        <Link to={`/employees/${log.targetId}`} className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm group-hover:shadow-md whitespace-nowrap">
                            Zobacz Profil <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform"/>
                        </Link>
                    )}
                 </div>
               );
             })}
           </div>
        )}
      </div>
    </div>
  );
}