import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User,Clock,Download,  Mail, Briefcase, CheckCircle, AlertTriangle, ArrowLeft, Trash2, Pencil, RefreshCw, CalendarCheck, Send, Layers, ListChecks, CheckSquare, Square } from 'lucide-react';
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
  onboardingTasks: OnboardingTask[]; // Nowe pole
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
  
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isAdmin = currentUser?.role === 'ADMIN';

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

  useEffect(() => {
    fetchEmployee();
  }, [id]);

// --- NOWE: SYNCHRONIZACJA ZADAŃ ---
  const handleSyncTasks = async () => {
      try {
          const res = await axios.post(`http://localhost:3000/api/employees/${id}/sync-tasks`);
          if (res.data.added > 0) {
              toast.success(`Dodano ${res.data.added} nowych zadań z działu.`);
          } else {
              toast.info('Wszystkie zadania są aktualne.');
          }
          fetchEmployee();
      } catch (error) {
          toast.error('Błąd synchronizacji zadań.');
      }
  };

  // --- OBSŁUGA ZADAŃ (ONBOARDING) ---
  const toggleTask = async (taskId: number, currentStatus: boolean) => {
      // Optymistyczna aktualizacja UI (szybkość)
      setEmployee(prev => prev ? ({
          ...prev,
          onboardingTasks: prev.onboardingTasks.map(t => 
              t.id === taskId ? { ...t, completed: !currentStatus } : t
          )
      }) : null);

      try {
          await axios.patch(`http://localhost:3000/api/onboarding-tasks/${taskId}`, {
              completed: !currentStatus
          });
      } catch (error) {
          toast.error('Błąd aktualizacji zadania');
          fetchEmployee(); // Cofnij zmiany w razie błędu
      }
  };

  // --- OBSŁUGA USUWANIA PRACOWNIKA ---
  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć tego pracownika?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/employees/${id}?adminId=${currentUser.id}`);
      toast.success('Pracownik usunięty');
      navigate('/employees');
    } catch (error) { toast.error('Błąd usuwania'); }
  };

  const handleSendInvite = async () => {
      if(!employee?.email) return toast.error("Brak adresu email");
      try {
          await axios.post('http://localhost:3000/api/resend-invite', { email: employee.email });
          toast.success("Zaproszenie wysłane ponownie!");
      } catch (e) { toast.error("Błąd wysyłania zaproszenia"); }
  };

  const handleRenewClick = async (item: any) => {
    if(!confirm(`Odnowić ${item.name}?`)) return;
    const today = new Date().toISOString().split('T')[0];
    const newExpiry = new Date(today);
    const years = item.duration ? parseFloat(item.duration) : 1;
    if(item.duration === '0.5') newExpiry.setMonth(newExpiry.getMonth() + 6);
    else newExpiry.setFullYear(newExpiry.getFullYear() + years);

    try {
        await axios.put(`http://localhost:3000/api/compliance/${item.id}`, { 
            issueDate: new Date(today).toISOString(),
            expiryDate: newExpiry.toISOString().split('T')[0],
            duration: item.duration
        });
        toast.success('Odnowiono uprawnienie');
        fetchEmployee();
    } catch (e) { toast.error('Błąd odnawiania'); }
  };

  const handleDeleteCompliance = async (compId: number) => {
      if(!confirm("Usunąć uprawnienie?")) return;
      try {
          await axios.delete(`http://localhost:3000/api/compliance/${compId}?adminId=${currentUser.id}`);
          toast.success("Usunięto uprawnienie");
          fetchEmployee();
      } catch(e) { toast.error("Błąd usuwania"); }
  }


  if (loading || !employee) return <div className="p-10 text-center text-slate-400">Ładowanie...</div>;

  // Logika statusów
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

      if (daysLeft <= 0) {
          statusColor = "bg-red-50 text-red-700 border-red-200";
          icon = <AlertTriangle size={20} />;
          label = "Wygasło";
          daysText = `${Math.abs(daysLeft)} dni temu`;
          showRenew = true;
          daysCountColor = "text-red-600";
      } else if (daysLeft < 30) {
          statusColor = "bg-orange-50 text-orange-700 border-orange-200";
          icon = <Clock size={20} />;
          label = "Wygasa wkrótce";
          showRenew = true;
          daysCountColor = "text-orange-600";
      }
      return { containerClass: statusColor, icon, label, formattedTime: daysText, showRenew, daysCountColor };
  };

  // Logika Postępu Zadań
  const totalTasks = employee.onboardingTasks?.length || 0;
  const completedTasks = employee.onboardingTasks?.filter(t => t.completed).length || 0;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in">
      
      {/* HEADER Z POWROTEM */}
      <div className="flex items-center justify-between mb-8">
        <Link to="/employees" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
            <ArrowLeft size={20} /> Wróć do listy
        </Link>
        
        {isAdmin && (
            <div className="flex gap-3">
                <Link to={`/employees/${id}/edit`} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-sm shadow-blue-200">
                    <Pencil size={18} /> Edytuj
                </Link>
                <button onClick={handleDelete} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors font-bold">
                    <Trash2 size={18} /> Usuń
                </button>
            </div>
        )}
      </div>

      {/* GŁÓWNY GRID: PROFIL (LEWO) + ZADANIA (PRAWO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* KOLUMNA LEWA: KARTA PRACOWNIKA (2/3 szerokości) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 flex flex-col md:flex-row gap-8 items-start">
                {/* AVATAR */}
                <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl font-bold text-slate-500 border border-slate-200 shadow-inner shrink-0">
                    {employee.avatarInitials}
                </div>

                {/* DANE */}
                <div className="flex-1 w-full">
                    <div className="flex justify-between items-start">
                        <div>
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
                                    <button onClick={handleSendInvite} className="ml-2 underline hover:text-orange-900 flex items-center gap-1"><Send size={12}/> Wyślij</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full font-bold">
                                    <CheckCircle size={14} /> Konto aktywne
                                </div>
                            )
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-slate-400">Brak konta</div>
                        )}
                    </div>
                </div>
            </div>
          </div>

          {/* KOLUMNA PRAWA: LISTA ZADAŃ (1/3 szerokości) */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-fit">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  {/* GÓRNY PASEK: Tytuł + Guzik */}
                  <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <ListChecks className="text-indigo-600" /> Onboarding
                      </h3>
                      
                      {/* Przycisk synchronizacji - Teraz ładnie w linii z tytułem */}
                      {isAdmin && (
                        <button 
                            onClick={handleSyncTasks}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white bg-transparent border border-transparent hover:border-slate-200 rounded-lg transition-all shadow-sm hover:shadow"
                            title="Pobierz brakujące zadania z działu"
                        >
                            <Download size={18} />
                        </button>
                      )}
                  </div>
                  
                  {/* PASEK POSTĘPU - Pod spodem */}
                  <div>
                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                          <span>Postęp</span>
                          <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                      </div>
                  </div>
              </div>

              <div className="p-2 flex-1 overflow-y-auto max-h-[300px]">
                  {employee.onboardingTasks && employee.onboardingTasks.length > 0 ? (
                      <ul className="space-y-1">
                          {employee.onboardingTasks.map(task => (
                              <li key={task.id} 
                                  onClick={() => isAdmin && toggleTask(task.id, task.completed)}
                                  className={`flex items-start gap-3 p-3 rounded-xl transition-all ${isAdmin ? 'cursor-pointer hover:bg-slate-50' : ''} ${task.completed ? 'opacity-60' : ''}`}
                              >
                                  <div className={`mt-0.5 ${task.completed ? 'text-green-500' : 'text-slate-300'}`}>
                                      {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                                  </div>
                                  <span className={`text-sm font-medium ${task.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                                      {task.task}
                                  </span>
                              </li>
                          ))}
                      </ul>
                  ) : (
                      <div className="text-center py-8 text-slate-400 text-sm">
                          Brak zadań do wykonania.
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* SEKCJA UPRAWNIEŃ (BEZ ZMIAN UKŁADU) */}
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle className="text-green-600"/> Certyfikaty i Uprawnienia
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employee.compliance.map(item => {
          const style = getStatusStyle(item.expiryDate);
          const isExpired = style.label === "Wygasło";

          return (
            <div key={item.id} className={`bg-white p-5 rounded-xl border transition-all hover:shadow-md flex justify-between items-center group ${isExpired ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
              
              <div>
                 <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${item.type === 'MANDATORY' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.type === 'MANDATORY' ? 'Obowiązkowe' : (item.type || 'Inne')}
                    </span>
                 </div>
                 <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                 <p className="text-xs text-slate-500 mt-1">
                    Ważne do: <span className="font-semibold">{new Date(item.expiryDate).toLocaleDateString()}</span>
                 </p>
              </div>

              <div className="text-right">
                 <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold mb-2 ${style.containerClass}`}>
                    {style.icon} {style.label}
                 </div>

                 {isExpired ? (
                    <div className="flex items-center gap-2 justify-end mt-1">
                        {style.showRenew && (
                            <button onClick={() => handleRenewClick(item)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-200 transition-colors" title="Odnów automatycznie"><RefreshCw size={20} /></button>
                        )}
                        <div className="text-red-500 bg-red-100/50 p-2 rounded-lg"><AlertTriangle size={24} /></div>
                    </div>
                 ) : (
                    <div className="flex items-center gap-3 justify-end">
                        {style.showRenew && <button onClick={() => handleRenewClick(item)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-200 transition-colors" title="Odnów automatycznie"><RefreshCw size={20} /></button>}
                        <div className="text-slate-400 text-sm text-right">
                            <span className={`block font-bold text-lg ${style.daysCountColor}`}>{style.formattedTime}</span>
                            zostało
                        </div>
                    </div>
                 )}
              </div>
            </div>
          )
        })}
      </div>
      
      {employee.compliance.length === 0 && (
          <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 mt-4 bg-slate-50">
              <p>Brak uprawnień.</p>
              <Link to={`/employees/${id}/edit`} className="text-blue-600 font-bold hover:underline">Kliknij, aby dodać.</Link>
          </div>
      )}
    </div>
  );
}