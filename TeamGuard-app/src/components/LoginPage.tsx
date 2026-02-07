import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, UserCheck, Briefcase, ShieldAlert, CheckCircle, Eye, EyeOff, KeyRound, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

const DURATION_OPTIONS = {
    'BHP': [
        { value: '0.5', label: '6 mies. (Wstępne)' },
        { value: '1', label: '1 rok (Robotnicze)' },
        { value: '3', label: '3 lata (Biurowe)' },
        { value: '5', label: '5 lat (Kierownicy)' }
    ],
    'MEDICAL': [
        { value: '1', label: '1 rok' },
        { value: '2', label: '2 lata' },
        { value: '3', label: '3 lata' },
        { value: '4', label: '4 lata' },
    ]
};

// Typ widoku dla obsługi wielu ekranów
type ViewState = 'LOGIN' | 'REGISTER' | 'FORGOT_EMAIL' | 'FORGOT_CODE' | 'FORGOT_NEW_PASS';

export function LoginPage() {
  const navigate = useNavigate();
  
  // Zmieniamy boolean isLoginMode na stan widoku
  const [view, setView] = useState<ViewState>('LOGIN');
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);
  
  // Pokaż/Ukryj hasło
  const [showPassword, setShowPassword] = useState(false); 

  // Dane do logowania/rejestracji
  const [authData, setAuthData] = useState({
    firstName: '', lastName: '', email: '', password: ''
  });

  // NOWE: Dane do resetu hasła
  const [resetData, setResetData] = useState({
    code: '', newPassword: '', confirmPassword: ''
  });

  // Dane pracownika (Onboarding - BEZ ZMIAN)
  const [empData, setEmpData] = useState({
    position: 'Kierownik / Administrator',
    hiredAt: new Date().toISOString().split('T')[0],
    bhpDate: '',
    medicalDate: '',
    bhpDuration: '5',
    medicalDuration: '2'
  });

  const handleNameInput = (e: React.ChangeEvent<HTMLInputElement>, field: 'firstName' | 'lastName') => {
      const val = e.target.value;
      const capitalized = val.charAt(0).toUpperCase() + val.slice(1);
      setAuthData({ ...authData, [field]: capitalized });
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authData.email)) {
        toast.error('Podaj poprawny adres e-mail');
        return false;
    }

    if (view === 'REGISTER') {
        if (authData.password.length < 8) {
            toast.error('Hasło musi mieć co najmniej 8 znaków.');
            return false;
        }
        const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
        if (!specialCharRegex.test(authData.password)) {
            toast.error('Hasło musi zawierać znak specjalny.');
            return false;
        }
    }
    return true;
  };

  // --- LOGIKA LOGOWANIA I REJESTRACJI ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (view === 'LOGIN') {
        const res = await axios.post('http://localhost:3000/api/login', {
            email: authData.email, password: authData.password
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success(`Witaj ponownie, ${res.data.user.firstName}!`);
        navigate('/');
      } else if (view === 'REGISTER') {
        const res = await axios.post('http://localhost:3000/api/register', authData);
        setCreatedUserId(res.data.userId);
        toast.success('Konto utworzone! Teraz uzupełnij swój profil pracowniczy.');
        setShowOnboarding(true);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Wystąpił błąd.');
    } finally {
      setLoading(false);
    }
  };

  // --- NOWE: LOGIKA RESETOWANIA HASŁA ---
  
  // 1. Wyślij kod na email
  const sendResetCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          await axios.post('http://localhost:3000/api/forgot-password', { email: authData.email });
          toast.success('Kod wysłany! Sprawdź skrzynkę e-mail.');
          setView('FORGOT_CODE');
      } catch (error: any) {
          toast.error(error.response?.data?.error || 'Błąd wysyłania kodu.');
      } finally { setLoading(false); }
  };

  // 2. Weryfikacja wizualna kodu (przejście dalej)
  const verifyCodeStep = (e: React.FormEvent) => {
      e.preventDefault();
      if (resetData.code.length < 6) return toast.error('Kod musi mieć 6 cyfr.');
      setView('FORGOT_NEW_PASS');
  };

  // 3. Ustaw nowe hasło
  const resetPasswordFinal = async (e: React.FormEvent) => {
      e.preventDefault();
      if (resetData.newPassword !== resetData.confirmPassword) return toast.error('Hasła nie są identyczne.');
      
      const strongRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>])[a-zA-Z0-9!@#$%^&*(),.?":{}|<>]{8,}$/;
      if (!strongRegex.test(resetData.newPassword)) return toast.error('Hasło za słabe (min 8 znaków, cyfra, znak spec).');

      setLoading(true);
      try {
          await axios.post('http://localhost:3000/api/reset-password', {
              email: authData.email,
              code: resetData.code,
              newPassword: resetData.newPassword
          });
          toast.success('Hasło zostało zmienione! Zaloguj się.');
          setView('LOGIN');
          setResetData({ code: '', newPassword: '', confirmPassword: '' });
          setAuthData(prev => ({ ...prev, password: '' })); // Czyścimy stare hasło
      } catch (error: any) {
          toast.error(error.response?.data?.error || 'Błąd resetowania hasła.');
      } finally { setLoading(false); }
  };


  // --- LOGIKA ONBOARDINGU (TWOJA ORYGINALNA) ---
  const handleOnboardingSubmit = async (skipped: boolean = false) => {
    setLoading(true);
    try {
        await axios.post('http://localhost:3000/api/employees/onboarding', {
            userId: createdUserId,
            firstName: authData.firstName,
            lastName: authData.lastName,
            email: authData.email,
            position: empData.position,
            hiredAt: empData.hiredAt,
            bhpDate: empData.bhpDate,
            bhpDuration: empData.bhpDuration,
            medicalDate: empData.medicalDate,
            medicalDuration: empData.medicalDuration,
            skipped: skipped
        });

        if (skipped) {
            toast.warning('Profil utworzony z zaległymi datami. Uzupełnij je w panelu!');
        } else {
            toast.success('Profil pracowniczy skonfigurowany!');
        }

        const loginRes = await axios.post('http://localhost:3000/api/login', {
            email: authData.email, password: authData.password
        });
        localStorage.setItem('token', loginRes.data.token);
        localStorage.setItem('user', JSON.stringify(loginRes.data.user));
        navigate('/');

    } catch (error) {
        toast.error('Błąd konfiguracji profilu.');
    } finally {
        setLoading(false);
    }
  };

  // =========================================================
  // RENDEROWANIE (WIDOKI)
  // =========================================================

  // WIDOK 1: ONBOARDING (PRIORYTETOWY JEŚLI showOnboarding === true)
  if (showOnboarding) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-green-600 p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm text-white border-2 border-white/30">
                            <Briefcase size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Witaj w Zespole!</h1>
                        <p className="text-green-100 mt-2 text-sm font-medium">Jako administrator, również jesteś pracownikiem. Uzupełnij swoje dane.</p>
                    </div>
                </div>

                <div className="p-8">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stanowisko</label>
                            <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-green-500 outline-none" 
                                value={empData.position} onChange={e => setEmpData({...empData, position: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Zatrudnienia</label>
                            <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-green-500 outline-none"
                                value={empData.hiredAt} onChange={e => setEmpData({...empData, hiredAt: e.target.value})} />
                        </div>
                        
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-3">
                            <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2"><ShieldAlert size={16}/> Uprawnienia Wymagane</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Data Szkolenia BHP</label>
                                    <input type="date" className="w-full p-2 bg-white border border-orange-200 rounded-lg text-sm outline-none focus:border-orange-400"
                                        value={empData.bhpDate} onChange={e => setEmpData({...empData, bhpDate: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Ważne przez</label>
                                    <select className="w-full p-2 bg-white border border-orange-200 rounded-lg text-sm outline-none focus:border-orange-400"
                                        value={empData.bhpDuration} onChange={e => setEmpData({...empData, bhpDuration: e.target.value})}>
                                        {DURATION_OPTIONS.BHP.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Data Badań Lek.</label>
                                    <input type="date" className="w-full p-2 bg-white border border-orange-200 rounded-lg text-sm outline-none focus:border-orange-400"
                                        value={empData.medicalDate} onChange={e => setEmpData({...empData, medicalDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Ważne przez</label>
                                <select className="w-full p-2 bg-white border border-orange-200 rounded-lg text-sm outline-none focus:border-orange-400"
                                    value={empData.medicalDuration} onChange={e => setEmpData({...empData, medicalDuration: e.target.value})}>
                                    {DURATION_OPTIONS.MEDICAL.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button onClick={() => handleOnboardingSubmit(false)} disabled={!empData.bhpDate || !empData.medicalDate || loading} className="w-full bg-green-600 text-white font-bold h-12 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Zapisywanie...' : 'Zapisz i Przejdź do Dashboardu'} <CheckCircle size={20} />
                    </button>
                    <button onClick={() => handleOnboardingSubmit(true)} className="w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Pomiń ten krok (Uzupełnię później)</button>
                    <p className="text-[10px] text-center text-red-400">* Pominięcie spowoduje oznaczenie uprawnień jako przeterminowane.</p>
                </div>
            </div>
        </div>
    </div>
    );
  }

  // WIDOK 2: GŁÓWNA KARTA LOGOWANIA / REJESTRACJI / ODZYSKIWANIA
  return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 overflow-hidden transition-all duration-300">
          
          {/* NAGŁÓWEK ZMIENNY W ZALEŻNOŚCI OD WIDOKU */}
          <div className={`p-8 text-center relative overflow-hidden ${view.startsWith('FORGOT') ? 'bg-orange-500' : 'bg-blue-600'}`}>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm text-white border-2 border-white/30">
                  {view === 'LOGIN' && <Lock size={32} />}
                  {view === 'REGISTER' && <UserCheck size={32} />}
                  {view.startsWith('FORGOT') && <KeyRound size={32} />}
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {view === 'LOGIN' && 'Zaloguj się'}
                {view === 'REGISTER' && 'Utwórz konto'}
                {view === 'FORGOT_EMAIL' && 'Reset hasła'}
                {view === 'FORGOT_CODE' && 'Weryfikacja'}
                {view === 'FORGOT_NEW_PASS' && 'Nowe hasło'}
              </h1>
              <p className="text-white/90 mt-2 text-sm font-medium">
                  {view === 'LOGIN' ? 'Dostęp do panelu zarządzania' : 
                   view === 'REGISTER' ? 'Zarejestruj pierwszego administratora' :
                   view === 'FORGOT_EMAIL' ? 'Podaj e-mail, aby otrzymać kod' :
                   view === 'FORGOT_CODE' ? 'Wpisz 6-cyfrowy kod z maila' :
                   'Ustaw silne, bezpieczne hasło'}
              </p>
            </div>
            {/* Tło ozdobne */}
            <div className="absolute top-[-50%] left-[-20%] w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-[-50%] right-[-20%] w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          <div className="p-8">
            
            {/* --- FORMULARZ LOGOWANIA I REJESTRACJI --- */}
            {(view === 'LOGIN' || view === 'REGISTER') && (
                <form onSubmit={handleAuthSubmit} className="space-y-5">
                    {view === 'REGISTER' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Imię</label>
                                <input type="text" required placeholder="Jan" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-300" 
                                    value={authData.firstName} onChange={e => handleNameInput(e, 'firstName')} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nazwisko</label>
                                <input type="text" required placeholder="Kowalski" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-300" 
                                    value={authData.lastName} onChange={e => handleNameInput(e, 'lastName')} />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <div className="relative">
                            <input type="email" required placeholder="jan.kowalski@firma.pl" className="w-full p-3 pl-11 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-slate-300" 
                                value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} />
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasło</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} required placeholder="••••••••" 
                                className="w-full p-3 pl-11 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-slate-300 transition-colors" 
                                value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} 
                            />
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none" tabIndex={-1}>
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {view === 'LOGIN' && (
                             <div className="flex justify-end mt-2">
                                <button type="button" onClick={() => setView('FORGOT_EMAIL')} className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">
                                    Nie pamiętasz hasła?
                                </button>
                            </div>
                        )}
                        {view === 'REGISTER' && <p className="text-[10px] text-slate-400 mt-1 pl-1">Min. 8 znaków i jeden znak specjalny.</p>}
                    </div>

                    <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white font-bold h-12 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 group disabled:opacity-70">
                        {loading ? 'Przetwarzanie...' : (view === 'LOGIN' ? 'Zaloguj się' : 'Zarejestruj się')} {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>}
                    </button>
                </form>
            )}

            {/* --- FORMULARZ ODZYSKIWANIA HASŁA: KROK 1 (EMAIL) --- */}
            {view === 'FORGOT_EMAIL' && (
                <form onSubmit={sendResetCode} className="space-y-5 animate-in slide-in-from-right">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Twój Email</label>
                        <div className="relative">
                            <input type="email" required placeholder="jan@firma.pl" className="w-full p-3 pl-11 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500" 
                                value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} />
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        </div>
                    </div>
                    <button disabled={loading} className="w-full bg-orange-500 text-white font-bold h-12 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30">
                        {loading ? 'Wysyłanie...' : 'Wyślij kod weryfikacyjny'}
                    </button>
                    <button type="button" onClick={() => setView('LOGIN')} className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-600 py-2">
                        <ChevronLeft size={16}/> Wróć do logowania
                    </button>
                </form>
            )}

            {/* --- FORMULARZ ODZYSKIWANIA: KROK 2 (KOD) --- */}
            {view === 'FORGOT_CODE' && (
                <form onSubmit={verifyCodeStep} className="space-y-5 animate-in slide-in-from-right">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kod z e-maila</label>
                        <input type="text" maxLength={6} required placeholder="123456" className="w-full p-4 text-center text-3xl tracking-[0.5em] font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500" 
                            value={resetData.code} onChange={e => setResetData({...resetData, code: e.target.value})} />
                    </div>
                    <button className="w-full bg-orange-500 text-white font-bold h-12 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30">
                        Dalej
                    </button>
                    <button type="button" onClick={() => setView('FORGOT_EMAIL')} className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-600 py-2">
                        <ChevronLeft size={16}/> Wyślij ponownie / Popraw email
                    </button>
                </form>
            )}

            {/* --- FORMULARZ ODZYSKIWANIA: KROK 3 (NOWE HASŁO) --- */}
            {view === 'FORGOT_NEW_PASS' && (
                <form onSubmit={resetPasswordFinal} className="space-y-5 animate-in slide-in-from-right">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nowe hasło</label>
                        <input type="password" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500" 
                            value={resetData.newPassword} onChange={e => setResetData({...resetData, newPassword: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Powtórz hasło</label>
                        <input type="password" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500" 
                            value={resetData.confirmPassword} onChange={e => setResetData({...resetData, confirmPassword: e.target.value})} />
                    </div>
                    <button disabled={loading} className="w-full bg-green-600 text-white font-bold h-12 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30">
                        {loading ? 'Zapisywanie...' : 'Zmień hasło i zaloguj'}
                    </button>
                </form>
            )}

            {/* PRZEŁĄCZNIK LOGIN / REJESTRACJA (Tylko gdy nie resetujemy hasła) */}
            {(view === 'LOGIN' || view === 'REGISTER') && (
                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500">
                        {view === 'LOGIN' ? 'Nie masz konta?' : 'Masz już konto?'} 
                        <button onClick={() => setView(view === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="ml-2 font-bold text-blue-600 hover:text-blue-700 hover:underline">
                            {view === 'LOGIN' ? 'Zarejestruj się' : 'Zaloguj się'}
                        </button>
                    </p>
                </div>
            )}
            
          </div>
        </div>
      </div>
  );
}