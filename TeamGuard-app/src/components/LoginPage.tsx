import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, ArrowRight, UserCheck, Briefcase, ShieldAlert, CheckCircle, Eye, EyeOff, KeyRound, ChevronLeft, Shield } from 'lucide-react';
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
// Dodano 'SET_PASSWORD' do typów widoku
type ViewState = 'LOGIN' | 'REGISTER' | 'FORGOT_EMAIL' | 'FORGOT_CODE' | 'FORGOT_NEW_PASS' | 'SET_PASSWORD';


export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Do pobrania tokena z URL
  
  // Stan widoku
  const [view, setView] = useState<ViewState>('LOGIN');
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);

  // Dane zaproszonego użytkownika (z tokena)
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteUser, setInviteUser] = useState<{ firstName: string; lastName: string; email: string } | null>(null);
  
  // Pokaż/Ukryj hasło
  const [showPassword, setShowPassword] = useState(false); 
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Dane do logowania/rejestracji - DODANO adminCode
  const [authData, setAuthData] = useState({
    firstName: '', lastName: '', email: '', password: '', adminCode: '' 
  });

  // Dane do resetu hasła
  const [resetData, setResetData] = useState({
    code: '', newPassword: '', confirmPassword: ''
  });

  // Dane pracownika (Onboarding)
  const [empData, setEmpData] = useState({
    position: 'Kierownik / Administrator',
    hiredAt: new Date().toISOString().split('T')[0],
    bhpDate: '',
    medicalDate: '',
    bhpDuration: '5',
    medicalDuration: '2'
  });

  // --- 1. SPRAWDZANIE LINKU ZAPROSZENIA ---
  useEffect(() => {
      const tokenFromUrl = searchParams.get('token');
      if (tokenFromUrl) {
          setLoading(true);
          // Weryfikujemy token w backendzie
          axios.get(`http://localhost:3000/api/auth/verify-invite?token=${tokenFromUrl}`)
              .then(res => {
                  setInviteToken(tokenFromUrl);
                  setInviteUser(res.data); // Mamy imię i nazwisko!
                  setView('SET_PASSWORD'); // Przełączamy widok
                  // Automatycznie wypełniamy email, żeby user nie musiał
                  setAuthData(prev => ({ ...prev, email: res.data.email }));
              })
              .catch(err => {
                  toast.error('Link aktywacyjny jest nieważny lub wygasł.');
                  // Usuwamy token z URL, żeby nie mylił
                  navigate('/login', { replace: true });
              })
              .finally(() => setLoading(false));
      }
  }, [searchParams, navigate]);

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
        // --- NOWA WALIDACJA KODU ---
        if (!authData.adminCode) {
            toast.error('Wymagany jest kod autoryzacji od administratora.');
            return false;
        }
        // ---------------------------

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
        // authData zawiera teraz adminCode
        const res = await axios.post('http://localhost:3000/api/register', authData);
        setCreatedUserId(res.data.userId);
        toast.success('Konto Managera utworzone! Uzupełnij profil.');
        setShowOnboarding(true);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Wystąpił błąd.');
    } finally {
      setLoading(false);
    }
  };

// --- OBSŁUGA USTAWIANIA HASŁA (Z LINKU) ---
  const handleSetInvitePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (resetData.newPassword !== resetData.confirmPassword) return toast.error('Hasła nie są identyczne');
      if (resetData.newPassword.length < 8) return toast.error('Hasło min. 8 znaków');

      setLoading(true);
      try {
          // Ustawiamy hasło
          await axios.post('http://localhost:3000/api/auth/set-password', { 
              token: inviteToken, 
              password: resetData.newPassword 
          });
          
          toast.success('Hasło ustawione pomyślnie!');
          
          // Automatyczne logowanie po ustawieniu hasła
          const loginRes = await axios.post('http://localhost:3000/api/login', {
              email: inviteUser?.email,
              password: resetData.newPassword
          });
          
          localStorage.setItem('token', loginRes.data.token);
          localStorage.setItem('user', JSON.stringify(loginRes.data.user));
          
          // Czyścimy URL z tokena i idziemy do dashboardu (profilu)
          navigate('/', { replace: true });

      } catch (error: any) {
          toast.error(error.response?.data?.error || 'Błąd ustawiania hasła.');
      } finally { setLoading(false); }
  };

  // --- LOGIKA RESETOWANIA HASŁA ---
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

  const verifyCodeStep = (e: React.FormEvent) => {
      e.preventDefault();
      if (resetData.code.length < 6) return toast.error('Kod musi mieć 6 cyfr.');
      setView('FORGOT_NEW_PASS');
  };

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
          setAuthData(prev => ({ ...prev, password: '' })); 
      } catch (error: any) {
          toast.error(error.response?.data?.error || 'Błąd resetowania hasła.');
      } finally { setLoading(false); }
  };


 // --- ZMODYFIKOWANA FUNKCJA ONBOARDINGU ---
  const handleOnboardingSubmit = async (skipped: boolean = false) => {
    setLoading(true);
    
    // 1. NAJPIERW TWORZYMY PROFIL (ONBOARDING)
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

        if (skipped) toast.warning('Profil utworzony (dane do uzupełnienia).');
        else toast.success('Profil skonfigurowany pomyślnie!');

    } catch (error: any) {
        console.error("Błąd onboardingu:", error);
        toast.error(error.response?.data?.error || 'Błąd zapisu profilu pracownika.');
        setLoading(false);
        return; // Jeśli onboarding padł, przerywamy i nie próbujemy logować
    }

    // 2. JEŚLI PROFIL SIĘ UDAŁ -> PRÓBUJEMY SIĘ ZALOGOWAĆ
    try {
        const loginRes = await axios.post('http://localhost:3000/api/login', {
            email: authData.email, 
            password: authData.password
        });
        
        localStorage.setItem('token', loginRes.data.token);
        localStorage.setItem('user', JSON.stringify(loginRes.data.user));
        toast.success(`Zalogowano jako ${loginRes.data.user.firstName}`);
        navigate('/');

    } catch (error: any) {
        // Jeśli tu trafiłeś, to znaczy że profil JEST w bazie, ale logowanie nie wyszło.
        console.error("Błąd auto-logowania:", error);
        toast.error('Profil utworzony, ale wystąpił błąd logowania. Zaloguj się ręcznie.');
        
        // Zamiast zostać na ekranie onboardingu (który już wysłał dane!), wracamy do logowania
        setShowOnboarding(false);
        setView('LOGIN');
    } finally {
        setLoading(false);
    }
  };

  // =========================================================
  // RENDEROWANIE (WIDOKI)
  // =========================================================

  // WIDOK 1: ONBOARDING
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

  // WIDOK 2: GŁÓWNA KARTA
  return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 overflow-hidden transition-all duration-300">
          
          {/* NAGŁÓWEK */}
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
                   view === 'REGISTER' ? 'Rejestracja Managera (Wymagany Kod)' :
                   view === 'FORGOT_EMAIL' ? 'Podaj e-mail, aby otrzymać kod' :
                   view === 'FORGOT_CODE' ? 'Wpisz 6-cyfrowy kod z maila' :
                   'Ustaw silne, bezpieczne hasło'}
              </p>
            </div>
            <div className="absolute top-[-50%] left-[-20%] w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-[-50%] right-[-20%] w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          <div className="p-8">
            
            {/* --- FORMULARZ LOGOWANIA I REJESTRACJI --- */}
            {(view === 'LOGIN' || view === 'REGISTER') && (
                <form onSubmit={handleAuthSubmit} className="space-y-5">
                    {view === 'REGISTER' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
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

                            {/* --- NOWE POLE: KOD AUTORYZACJI (DODANO) --- */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-blue-600">Kod Autoryzacji (Manager)</label>
                                <div className="relative">
                                    <input type="text" required placeholder="Np. MANAGER2024" className="w-full p-3 pl-11 bg-blue-50 border border-blue-200 rounded-xl focus:outline-none focus:border-blue-500 text-blue-900 font-bold placeholder:text-blue-300" 
                                        value={authData.adminCode} onChange={e => setAuthData({...authData, adminCode: e.target.value})} />
                                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400" size={20} />
                                </div>
                            </div>
                            {/* ------------------------------------------- */}
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
                        {loading ? 'Przetwarzanie...' : (view === 'LOGIN' ? 'Zaloguj się' : 'Zarejestruj Managera')} {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>}
                    </button>
                </form>
            )}

            {/* --- 2. FORMULARZ USTAWIANIA HASŁA (NOWY PRACOWNIK Z LINKU) --- */}
            {view === 'SET_PASSWORD' && (
    <form onSubmit={handleSetInvitePassword} className="space-y-5 animate-in slide-in-from-right">
        <div className="text-center mb-4">
            <p className="text-sm text-slate-500">Twój email: <span className="font-bold text-slate-800">{inviteUser?.email}</span></p>
        </div>

        {/* --- NOWE HASŁO --- */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nowe hasło</label>
            <div className="relative"> {/* 1. Wrapper relative */}
                <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    className="w-full p-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800" // Dodałem pr-12
                    value={resetData.newPassword} 
                    onChange={e => setResetData({...resetData, newPassword: e.target.value})} 
                />
                <button
                    type="button" // Ważne, żeby nie wysyłało formularza!
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
        </div>

        {/* --- POWTÓRZ HASŁO --- */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Powtórz hasło</label>
            <div className="relative"> {/* 1. Wrapper relative */}
                <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    required 
                    className="w-full p-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800" // Dodałem pr-12
                    value={resetData.confirmPassword} 
                    onChange={e => setResetData({...resetData, confirmPassword: e.target.value})} 
                />
                <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
        </div>

        <button disabled={loading} className="w-full bg-slate-800 text-white font-bold h-12 rounded-xl hover:bg-slate-900 transition-colors shadow-lg">
            {loading ? 'Zapisywanie...' : 'Aktywuj Konto i Zaloguj'}
        </button>
    </form>
)}

            {/* --- FORMULARZE ODZYSKIWANIA (BEZ ZMIAN) --- */}
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

            {view === 'FORGOT_NEW_PASS' && (
    <form onSubmit={resetPasswordFinal} className="space-y-5 animate-in slide-in-from-right">
        
        {/* --- NOWE HASŁO --- */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nowe hasło</label>
            <div className="relative"> {/* 1. Wrapper */}
                <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    className="w-full p-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500" // 2. Dodany padding pr-12
                    value={resetData.newPassword} 
                    onChange={e => setResetData({...resetData, newPassword: e.target.value})} 
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
        </div>

        {/* --- POWTÓRZ HASŁO --- */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Powtórz hasło</label>
            <div className="relative"> {/* 1. Wrapper */}
                <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    required 
                    className="w-full p-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500" // 2. Dodany padding pr-12
                    value={resetData.confirmPassword} 
                    onChange={e => setResetData({...resetData, confirmPassword: e.target.value})} 
                />
                <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
        </div>

        <button disabled={loading} className="w-full bg-green-600 text-white font-bold h-12 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30">
            {loading ? 'Zapisywanie...' : 'Zmień hasło i zaloguj'}
        </button>
    </form>
)}

            {/* PRZEŁĄCZNIK LOGIN / REJESTRACJA */}
            {(view === 'LOGIN' || view === 'REGISTER') && (
                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500">
                        {view === 'LOGIN' ? 'Jesteś Managerem?' : 'Masz już konto?'} 
                        <button onClick={() => setView(view === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="ml-2 font-bold text-blue-600 hover:text-blue-700 hover:underline">
                            {view === 'LOGIN' ? 'Zarejestruj się kodem' : 'Zaloguj się'}
                        </button>
                    </p>
                </div>
            )}
            
          </div>
        </div>
      </div>
  );
}