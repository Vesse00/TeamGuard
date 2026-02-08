import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, data } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Briefcase, CheckCircle, AlertTriangle, ArrowLeft, Trash2, Pencil, RefreshCw, CalendarCheck, Send, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  hiredAt: string;
  avatarInitials: string;
  isSystemAdmin: boolean;
  department: string;
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
      .then(res => { setEmployee(res.data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  };

  useEffect(() => { fetchEmployee(); }, [id]);

  const formatTimeRemaining = (expiryDateStr: string) => {
    const now = new Date();
    const target = new Date(expiryDateStr);
    now.setHours(0,0,0,0);
    target.setHours(0,0,0,0);

    if (target <= now) return "0 dni";

    let years = target.getFullYear() - now.getFullYear();
    let months = target.getMonth() - now.getMonth();
    let days = target.getDate() - now.getDate();

    if (days < 0) {
        months--;
        const prevMonthDate = new Date(target.getFullYear(), target.getMonth(), 0);
        days += prevMonthDate.getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    const getYearsLabel = (n: number) => {
        if (n === 1) return "rok";
        const lastDigit = n % 10;
        const lastTwo = n % 100;
        if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return "lata";
        return "lat";
    };
    const getDaysLabel = (n: number) => {
        if (n === 1) return "dzień";
        return "dni";
    };

    const parts = [];
    if (years > 0) parts.push(`${years} ${getYearsLabel(years)}`);
    if (months > 0) parts.push(`${months} mies.`);
    if (days > 0) parts.push(`${days} ${getDaysLabel(days)}`);

    return parts.join(' ');
  };

  const executeRenew = async (item: any) => {
    const today = new Date();
    const duration = item.duration || '1'; 
    const newExpiry = new Date(today);
    // Pobierz adminId
    const userStr = localStorage.getItem('user');
    const adminId = userStr ? JSON.parse(userStr).id : null;

    if (duration === '0.5') newExpiry.setMonth(newExpiry.getMonth() + 6);
    else newExpiry.setFullYear(newExpiry.getFullYear() + parseInt(duration));

    const apiPayload = {
        issueDate: today.toISOString(),
        expiryDate: newExpiry.toISOString().split('T')[0],
        duration: duration,
        adminId: adminId
    };

    try {
        await axios.put(`http://localhost:3000/api/compliance/${item.id}`, apiPayload);
        toast.success('Uprawnienie zostało pomyślnie odnowione!');
        fetchEmployee();
    } catch (error) { toast.error('Wystąpił błąd podczas odnawiania.'); }
  };

  const handleRenewClick = (item: any) => {
    const durationLabel = item.duration === '0.5' ? '6 miesięcy' : `${item.duration} lat(a)`;
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm">
        <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><RefreshCw size={24} /></div>
            <div>
                <h3 className="text-lg font-bold text-slate-800">Odnowić uprawnienie?</h3>
                <p className="text-sm text-slate-500 mt-1">Czy chcesz odnowić <strong>{item.name}</strong> od dzisiaj?</p>
                <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 inline-flex px-2 py-1 rounded items-center gap-1">
                    <CalendarCheck size={12}/> Nowy okres ważności: {durationLabel}
                </div>
            </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={() => toast.dismiss(t)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Anuluj</button>
          <button onClick={() => { toast.dismiss(t); executeRenew(item); }} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-colors">Potwierdź</button>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  };

  // Funkcja wysyłania zaproszenia
  const handleSendInvite = async () => {
    if (!employee) return;
    const toastId = toast.loading('Wysyłanie zaproszenia...');
    
    try {
        await axios.post(`http://localhost:3000/api/employees/${employee.id}/invite`, {
            adminId: currentUser?.id
        });
        toast.success('Wysłano zaproszenie na email', { id: toastId });
    } catch (error) {
        console.error(error);
        toast.error('Błąd wysyłania zaproszenia', { id: toastId });
    }
  };

  const getComplianceStyle = (expiryDateStr: string) => {
    const today = new Date();
    const expiry = new Date(expiryDateStr);
    const diffTime = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isExpired = daysLeft <= 0; 
    const isWarning = daysLeft > 0 && daysLeft <= 30; 
    
    const formattedTime = formatTimeRemaining(expiryDateStr);

    if (isExpired) {
      return {
        isExpired: true,
        daysLeft, 
        formattedTime: null,
        showRenew: true,
        borderClass: 'border-l-red-500 border-y border-r border-slate-200 bg-red-50/40',
        dateClass: 'text-red-700',
        badge: <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold uppercase ml-2">PO TERMINIE</span>,
        daysCountColor: 'text-red-600'
      };
    } else if (isWarning) {
      return {
        isExpired: false,
        daysLeft,
        formattedTime,
        showRenew: true,
        borderClass: 'border-l-amber-500 border-y border-r border-slate-200 bg-amber-50/40',
        dateClass: 'text-amber-700',
        badge: <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase ml-2">WYGASA</span>,
        daysCountColor: 'text-amber-600'
      };
    } else {
      return {
        isExpired: false,
        daysLeft,
        formattedTime,
        showRenew: false,
        borderClass: 'border-l-green-500 border-y border-r border-slate-200',
        dateClass: 'text-slate-800',
        badge: null,
        daysCountColor: 'text-slate-600'
      };
    }
  };

  const executeDelete = async () => {
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;

    try { 
      await axios.delete(`http://localhost:3000/api/employees/${id}?adminId=${currentUser?.id}`);
      toast.success('Pracownik został pomyślnie usunięty.'); navigate('/employees');
   } catch {
     toast.error('Wystąpił błąd podczas usuwania.'); 
    }
  };

  const handleDeleteClick = () => {
    if (!employee) return;
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm">
        <div className="flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-full"><Trash2 size={24} /></div>
            <div>
                <h3 className="text-lg font-bold text-slate-800">Usunąć pracownika?</h3>
                <p className="text-sm text-slate-500 mt-1">Czy na pewno chcesz usunąć <strong>{employee.firstName} {employee.lastName}</strong>?</p>
            </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={() => toast.dismiss(t)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg">Anuluj</button>
          <button onClick={() => { toast.dismiss(t); executeDelete(); }} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-200">Usuń trwale</button>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  };

  if (loading) return <div className="p-10 text-slate-500">Ładowanie profilu...</div>;
  if (!employee) return <div className="p-10 text-red-500">Nie znaleziono pracownika.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {isAdmin && (
        <Link to="/employees" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"><ArrowLeft size={18} /> Wróć do listy</Link>
      )}
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-white shadow-sm shrink-0">{employee.avatarInitials || <User size={40} />}</div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold text-slate-800">{employee.firstName} {employee.lastName}</h1>
            <p className="text-lg text-slate-500 font-medium mb-4">{employee.position} / {employee.department}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200"><Mail size={14} /> {employee.email || 'Brak e-maila'}</div>
              {/* PRZYCISK ZAPROSZENIA (Widoczny tylko dla Admina) */}
              {isAdmin && (
                  <>
                      {/* SCENARIUSZ 1: Użytkownik ma konto i nie ma tokena (czyli jest AKTYWNY) */}
                      {employee.user && employee.user.inviteToken === null ? (
                          <div className="ml-2 flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 text-xs font-bold select-none cursor-default" title="Użytkownik zarejestrowany i aktywny">
                              <UserCheck size={14} />
                              Konto Aktywne
                          </div>
                      ) : (
                          /* SCENARIUSZ 2: Brak konta LUB konto oczekujące (ma token) -> Pokaż przycisk */
                          <button 
                              onClick={handleSendInvite}
                              className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1 font-bold"
                              title={employee.user ? "Wyślij zaproszenie ponownie" : "Wyślij zaproszenie"}
                          >
                              <Send size={12} /> 
                              {employee.user ? "Wyślij ponownie" : "Wyślij Zaproszenie"}
                          </button>
                      )}
                  </>
              )}
              <div className="flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200"><Briefcase size={14} /> Zatrudniony: {new Date(employee.hiredAt).toLocaleDateString()}</div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-3">
                <Link to={`/employees/${employee.id}/edit`} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium shadow-sm transition-colors h-full flex items-center gap-2 decoration-0"><Pencil size={16}/> Edytuj Profil / Uprawnienia</Link>
                {!employee.isSystemAdmin && (
                  <button onClick={handleDeleteClick} className="bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 hover:border-red-200 p-2.5 rounded-lg transition-colors shadow-sm" title="Usuń pracownika"><Trash2 size={20} /></button>
                )}
            </div>
          )}
        </div>
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle className="text-blue-600" size={20}/> Status Uprawnień</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employee.compliance.map((item) => {
          const style = getComplianceStyle(item.expiryDate);
          return (
            <div key={item.id} className={`p-5 rounded-xl border-l-4 shadow-sm flex items-center justify-between transition-all ${style.borderClass}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">{item.type && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-white/50 px-1 rounded">{item.type}</span>}</div>
                <p className="text-base font-bold text-slate-700 mb-1">{item.name}</p>
                <div className="flex items-center gap-2"><span className={`text-lg font-bold ${style.dateClass}`}>{new Date(item.expiryDate).toLocaleDateString()}</span>{style.badge}</div>
              </div>

              <div className="text-right">
                 {style.isExpired ? (
                    <div className="flex items-center gap-3">
                        {isAdmin && (                        
                          <button onClick={() => handleRenewClick(item)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-200 transition-colors" title="Odnów automatycznie"><RefreshCw size={20} /></button>
                        )}
                        {/* ZMIANA: Usunięty tekst pod wykrzyknikiem */}
                        <div className="text-red-500 bg-red-100/50 p-2 rounded-lg">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                 ) : (
                    <div className="flex items-center gap-3">
                        {style.showRenew && <button onClick={() => handleRenewClick(item)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-200 transition-colors" title="Odnów automatycznie"><RefreshCw size={20} /></button>}
                        <div className="text-slate-400 text-sm text-right">
                            <span className={`block font-bold text-lg ${style.daysCountColor}`}>
                                {style.formattedTime}
                            </span>
                            zostało

                        </div>
                    </div>
                 )}
              </div>
            </div>
          )
        })}
      </div>
      {employee.compliance.length === 0 && <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 mt-4">Brak przypisanych uprawnień. Kliknij "Edytuj Profil", aby dodać.</div>}
    </div>
  );
}