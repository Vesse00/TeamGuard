import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    User, Mail, Briefcase, CheckCircle, AlertTriangle, ArrowLeft, Trash2, Pencil, 
    RefreshCw, CalendarCheck, Send, Layers, ListChecks, CheckSquare, Square, 
    Download, Clock, Timer, Play 
} from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingTask {
    id: number;
    task: string;
    completed: boolean;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  hiredAt: string;
  avatarInitials: string;
  isSystemAdmin: boolean;
  department?: { id: number; name: string };
  onboardingTasks: OnboardingTask[];
  compliance: {
    id: number;
    name: string;
    expiryDate: string;
    duration: string;
    status: string;
    type?: string;
  }[];
  user?: {
    id: number;
    inviteToken: string | null;
    email: string;
  };
}

export function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  
  // --- STATE RCP ---
  const [isWorking, setIsWorking] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  // Pobieranie usera (synchroniczne)
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isAdmin = currentUser?.role === 'ADMIN';
  const isOwner = currentUser?.employeeId === Number(id);

  // 1. ZABEZPIECZENIE PRZED PODGLĄDANIEM (User widzi tylko siebie)
  useEffect(() => {
    if (currentUser && !isAdmin && currentUser.employeeId !== Number(id)) {
        toast.error("Brak dostępu do tego profilu.");
        if (currentUser.employeeId) {
            navigate(`/employees/${currentUser.employeeId}`, { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }
  }, [id, isAdmin, currentUser, navigate]);

  const fetchEmployee = () => {
    axios.get(`http://localhost:3000/api/employees/${id}`)
      .then(res => {
        setEmployee(res.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Nie znaleziono pracownika');
        navigate('/employees');
      });
  };

  const fetchHistory = async () => {
      try {
          const res = await axios.get(`http://localhost:3000/api/work-log/history/${id}`);
          setWorkHistory(res.data);
      } catch(e) { console.error("Błąd historii"); }
  }

  // --- LOGIKA RCP (Start/Stop) ---
  const checkWorkStatus = async () => {
      try {
          const res = await axios.get(`http://localhost:3000/api/work-log/status/${id}`);
          if (res.data.isWorking) {
              setIsWorking(true);
              setStartTime(new Date(res.data.activeLog.startedAt));
          } else {
              setIsWorking(false);
              setStartTime(null);
              setElapsedTime("00:00:00");
          }
      } catch (error) { console.error("Błąd statusu RCP"); }
  };

  const handleStartWork = async () => {
      try {
          await axios.post('http://localhost:3000/api/work-log/start', { employeeId: id });
          setIsWorking(true);
          setStartTime(new Date());
          toast.success("Rozpoczęto pracę!");
          fetchHistory();
      } catch (e) { toast.error("Błąd startu pracy"); }
  };

  const handleStopWork = async () => {
      try {
          await axios.post('http://localhost:3000/api/work-log/stop', { employeeId: id });
          setIsWorking(false);
          setStartTime(null);
          setElapsedTime("00:00:00");
          toast.success("Zakończono pracę!");
          fetchHistory();
      } catch (e) { toast.error("Błąd kończenia pracy"); }
  };

  // Licznik czasu
  useEffect(() => {
      let interval: any;
      const updateTimer = () => {
          if (!startTime) return;
          
          const now = new Date();
          // Obliczamy różnicę, Math.max(0, ...) zapobiega ujemnym liczbom przy różnicach zegarów
          const diff = Math.max(0, now.getTime() - startTime.getTime());

          const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
          const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
          
          setElapsedTime(`${h}:${m}:${s}`);
      };

      if (isWorking && startTime) {
          // 1. Wywołaj raz natychmiast, żeby nie czekać 1s na pierwsze odświeżenie
          updateTimer(); 
          // 2. Ustaw interwał co 1s
          interval = setInterval(updateTimer, 1000);
      }

      return () => {
          if (interval) clearInterval(interval);
      };
  }, [isWorking, startTime]);

  useEffect(() => {
    // Jeśli autoryzacja przeszła (lub jest w trakcie), pobieramy dane
    if (isAdmin || (currentUser?.employeeId === Number(id))) {
        fetchEmployee();
        fetchHistory();
        checkWorkStatus();
    }
  }, [id, isAdmin, currentUser]);

  // --- POZOSTAŁE FUNKCJE ---
  const handleSyncTasks = async () => {
      try {
          const res = await axios.post(`http://localhost:3000/api/employees/${id}/sync-tasks`);
          if (res.data.added > 0) toast.success(`Dodano ${res.data.added} nowych zadań.`);
          else toast.info('Zadania są aktualne.');
          fetchEmployee();
      } catch (error) { toast.error('Błąd synchronizacji.'); }
  };

  const toggleTask = async (taskId: number, currentStatus: boolean) => {
      setEmployee(prev => prev ? ({ ...prev, onboardingTasks: prev.onboardingTasks.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t) }) : null);
      try { await axios.patch(`http://localhost:3000/api/onboarding-tasks/${taskId}`, { completed: !currentStatus }); } 
      catch (error) { toast.error('Błąd aktualizacji'); fetchEmployee(); }
  };

  const handleDelete = async () => {
    if (!confirm('Czy na pewno usunąć pracownika?')) return;
    try { await axios.delete(`http://localhost:3000/api/employees/${id}?adminId=${currentUser.id}`); toast.success('Usunięto.'); navigate('/employees'); } 
    catch (error) { toast.error('Błąd usuwania'); }
  };

  const handleSendInvite = async () => {
      if(!employee?.email) return toast.error("Brak emaila");
      try { await axios.post('http://localhost:3000/api/resend-invite', { email: employee.email }); toast.success("Wysłano!"); } 
      catch (e) { toast.error("Błąd wysyłania"); }
  };

  const handleRenewClick = async (item: any) => {
    if(!confirm(`Odnowić ${item.name}?`)) return;
    const today = new Date().toISOString().split('T')[0];
    const newExpiry = new Date(today);
    const years = item.duration ? parseFloat(item.duration) : 1;
    if(item.duration === '0.5') newExpiry.setMonth(newExpiry.getMonth() + 6);
    else newExpiry.setFullYear(newExpiry.getFullYear() + years);

    try {
        await axios.put(`http://localhost:3000/api/compliance/${item.id}`, { issueDate: new Date(today).toISOString(), expiryDate: newExpiry.toISOString().split('T')[0], duration: item.duration });
        toast.success('Odnowiono.'); fetchEmployee();
    } catch (e) { toast.error('Błąd odnawiania'); }
  };

  const handleDeleteCompliance = async (compId: number) => {
      if(!confirm("Usunąć?")) return;
      try { await axios.delete(`http://localhost:3000/api/compliance/${compId}?adminId=${currentUser.id}`); toast.success("Usunięto."); fetchEmployee(); } 
      catch(e) { toast.error("Błąd usuwania"); }
  }

  if (loading || !employee) return <div className="p-10 text-center text-slate-400">Ładowanie...</div>;

  const getStatusStyle = (expiryDate: string) => {
      const today = new Date();
      const expiry = new Date(expiryDate);
      const diffTime = expiry.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      let statusColor = "bg-green-100 text-green-700 border-green-200";
      let icon = <CheckCircle size={20} />;
      let label = "Ważne";
      let daysText = `${daysLeft} dni`;
      let showRenew = false;
      let daysCountColor = "text-green-600";
      if (daysLeft < 0) { statusColor = "bg-red-50 text-red-700 border-red-200"; icon = <AlertTriangle size={20} />; label = "Wygasło"; daysText = `${Math.abs(daysLeft)} dni temu`; showRenew = true; daysCountColor = "text-red-600"; } 
      else if (daysLeft < 30) { statusColor = "bg-orange-50 text-orange-700 border-orange-200"; icon = <Clock size={20} />; label = "Wygasa wkrótce"; showRenew = true; daysCountColor = "text-orange-600"; }
      return { containerClass: statusColor, icon, label, formattedTime: daysText, showRenew, daysCountColor };
  };

  const totalTasks = employee.onboardingTasks?.length || 0;
  const completedTasks = employee.onboardingTasks?.filter(t => t.completed).length || 0;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        {isAdmin && (
        <Link to="/employees" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
            <ArrowLeft size={20} /> Wróć do listy
        </Link>
        )}
        
        
        <div className="flex items-center gap-3">
            {/* WIDGET RCP - Widoczny dla obu (jeśli to ich profil) */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm transition-all ${isWorking ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isWorking ? 'bg-green-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                    <Timer size={18} />
                </div>
                <div className="hidden sm:block">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Czas Pracy</p>
                    <p className={`font-mono font-bold leading-none ${isWorking ? 'text-green-700' : 'text-slate-700'}`}>
                        {isWorking ? elapsedTime : '--:--:--'}
                    </p>
                </div>
                {isWorking ? (
                    <button onClick={handleStopWork} className="ml-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors shadow-sm" title="Zakończ pracę">
                        <Square size={16} fill="currentColor" />
                    </button>
                ) : (
                    <button onClick={handleStartWork} className="ml-2 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors shadow-sm" title="Rozpocznij pracę">
                        <Play size={16} fill="currentColor" />
                    </button>
                )}
            </div>

            {isAdmin && (
                <>
                    <Link to={`/employees/${id}/edit`} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-sm shadow-blue-200">
                        <Pencil size={18} /> <span className="hidden sm:inline">Edytuj</span>
                    </Link>
                    <button onClick={handleDelete} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors font-bold">
                        <Trash2 size={18} /> <span className="hidden sm:inline">Usuń</span>
                    </button>
                </>
            )}
        </div>
      </div>

      {/* DYNAMICZNY GRID: Jeśli Admin -> 3 kolumny, Jeśli User -> 1 kolumna */}
      <div className={`grid grid-cols-1 gap-6 mb-8 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
          
          {/* KOLUMNA LEWA: DANE (Dla usera rozciąga się na całość) */}
          <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-1'}`}>
            <div className="p-8 flex flex-col md:flex-row gap-8 items-start">
                <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl font-bold text-slate-500 border border-slate-200 shadow-inner shrink-0">
                    {employee.avatarInitials}
                </div>
                <div className="flex-1 w-full">
                    <h1 className="text-3xl font-bold text-slate-800">{employee.firstName} {employee.lastName}</h1>
                    <div className="flex flex-wrap gap-4 mt-3">
                        <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <Briefcase size={16} /> <span className="font-medium">{employee.position}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <Layers size={16} /> <span className="font-medium">{employee.department?.name || 'Brak działu'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <Mail size={16} /> <span className="break-all">{employee.email}</span>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-4 pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <CalendarCheck size={16} className="text-blue-500"/>
                            Zatrudniony: <span className="font-bold text-slate-700">{new Date(employee.hiredAt).toLocaleDateString()}</span>
                        </div>
                        {employee.user ? (
                            employee.user.inviteToken ? (
                                <div className="flex items-center gap-2 text-sm bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-bold">
                                    <Clock size={14} /> Konto nieaktywne
                                    {isAdmin && (
                                        <button onClick={handleSendInvite} className="ml-2 underline hover:text-orange-900 flex items-center gap-1"><Send size={12}/> Wyślij</button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full font-bold"><CheckCircle size={14} /> Konto aktywne</div>
                            )
                        ) : (<div className="flex items-center gap-2 text-sm text-slate-400">Brak konta</div>)}
                    </div>
                </div>
            </div>
          </div>

          {/* KOLUMNA PRAWA: ONBOARDING - WIDOCZNA TYLKO DLA ADMINA */}
          {isAdmin && (
              <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-fit">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <ListChecks className="text-indigo-600" /> Onboarding
                          </h3>
                          <button onClick={handleSyncTasks} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white bg-transparent border border-transparent hover:border-slate-200 rounded-lg transition-all shadow-sm hover:shadow" title="Pobierz zadania">
                              <Download size={18} />
                          </button>
                      </div>
                      <div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                              <span>Postęp</span><span>{progressPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progressPercent}%` }}></div>
                          </div>
                      </div>
                  </div>
                  <div className="p-2 flex-1 overflow-y-auto max-h-[400px]">
                      {employee.onboardingTasks && employee.onboardingTasks.length > 0 ? (
                          <ul className="space-y-1">
                              {employee.onboardingTasks.map(task => (
                                  <li key={task.id} onClick={() => toggleTask(task.id, task.completed)} className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-slate-50 ${task.completed ? 'opacity-50' : ''}`}>
                                      <div className={`mt-0.5 shrink-0 ${task.completed ? 'text-green-500' : 'text-slate-300'}`}>{task.completed ? <CheckSquare size={20} /> : <Square size={20} />}</div>
                                      <span className={`text-sm font-medium leading-snug ${task.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{task.task}</span>
                                  </li>
                              ))}
                          </ul>
                      ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm gap-2"><p>Brak zadań.</p><button onClick={handleSyncTasks} className="text-indigo-600 font-bold hover:underline text-xs flex items-center gap-1"><Download size={12}/> Pobierz</button></div>
                      )}
                  </div>
              </div>
          )}
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle className="text-green-600"/> Certyfikaty i Uprawnienia</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {employee.compliance.map(item => {
          const style = getStatusStyle(item.expiryDate);
          const isExpired = style.label === "Wygasło";
          return (
            <div key={item.id} className={`bg-white p-5 rounded-xl border transition-all hover:shadow-md flex justify-between items-center group ${isExpired ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
              <div>
                 <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${item.type === 'MANDATORY' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{item.type === 'MANDATORY' ? 'Obowiązkowe' : (item.type || 'Inne')}</span>
                 </div>
                 <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                 <p className="text-xs text-slate-500 mt-1">Ważne do: <span className="font-semibold">{new Date(item.expiryDate).toLocaleDateString()}</span></p>
              </div>
              <div className="text-right">
                 <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold mb-2 ${style.containerClass}`}>{style.icon} {style.label}</div>
                 
                 {/* ADMIN widzi przyciski odnawiania/usuwania */}
                 {isAdmin ? (
                     isExpired ? (
                        <div className="flex items-center gap-2 justify-end mt-1">
                            {style.showRenew && <button onClick={() => handleRenewClick(item)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-200 transition-colors"><RefreshCw size={20} /></button>}
                            <div className="text-red-500 bg-red-100/50 p-2 rounded-lg"><AlertTriangle size={24} /></div>
                        </div>
                     ) : (
                        <div className="flex items-center gap-3 justify-end">
                            {style.showRenew && <button onClick={() => handleRenewClick(item)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-200 transition-colors"><RefreshCw size={20} /></button>}
                            <div className="text-slate-400 text-sm text-right"><span className={`block font-bold text-lg ${style.daysCountColor}`}>{style.formattedTime}</span>zostało</div>
                        </div>
                     )
                 ) : (
                     // USER widzi tylko status
                     <div className="text-slate-400 text-sm text-right mt-2"><span className={`block font-bold text-lg ${style.daysCountColor}`}>{style.formattedTime}</span>zostało</div>
                 )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* HISTORIA RCP */}
      <div className="mt-8 pt-8 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="text-blue-600"/> Historia Czasu Pracy (Ostatnie 50)
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                      <tr>
                          <th className="p-4">Data</th>
                          <th className="p-4">Start</th>
                          <th className="p-4">Koniec</th>
                          <th className="p-4">Czas</th>
                          <th className="p-4">Źródło</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {workHistory.length > 0 ? workHistory.map((log) => {
                          const start = new Date(log.startedAt);
                          const end = log.endedAt ? new Date(log.endedAt) : null;
                          const duration = end ? ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2) + ' h' : 'W trakcie...';
                          
                          return (
                              <tr key={log.id} className="hover:bg-slate-50">
                                  <td className="p-4 font-medium text-slate-700">{start.toLocaleDateString()}</td>
                                  <td className="p-4 text-green-600 font-bold">{start.toLocaleTimeString()}</td>
                                  <td className="p-4 text-red-500 font-bold">{end ? end.toLocaleTimeString() : '-'}</td>
                                  <td className="p-4 font-mono">{duration}</td>
                                  <td className="p-4 text-slate-400 text-xs">{log.source}</td>
                              </tr>
                          );
                      }) : (
                          <tr><td colSpan={5} className="p-6 text-center text-slate-400">Brak historii pracy.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}