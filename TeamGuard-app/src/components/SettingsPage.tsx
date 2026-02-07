import { useState, useEffect } from 'react';
import { Save, User, Lock, Bell, Shield, Calendar, Clock, Play, Mail, FileText, Check, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';

// --- KONFIGURACJA DNI I GODZIN ---
const WEEK_DAYS = [
  { id: 'MONDAY', label: 'Pn' }, { id: 'TUESDAY', label: 'Wt' }, { id: 'WEDNESDAY', label: 'Śr' },
  { id: 'THURSDAY', label: 'Cz' }, { id: 'FRIDAY', label: 'Pt' }, { id: 'SATURDAY', label: 'So' }, { id: 'SUNDAY', label: 'Nd' },
];
const HOURS = Array.from({ length: 17 }, (_, i) => `${i + 6 < 10 ? '0' : ''}${i + 6}:00`); // 06:00 - 22:00

export function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  
  // Stany dla przycisków testowych
  const [testingAlert, setTestingAlert] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Stany formularzy
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', role: 'Administrator' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  // --- NOWE: STAN WIDOCZNOŚCI HASEŁ (OCZKO) ---
  const [showPasswords, setShowPasswords] = useState({
      current: false,
      new: false,
      confirm: false
  });

  // Stany powiadomień
  const [emailConfig, setEmailConfig] = useState({ enabled: true, days: [] as string[], time: '08:00' });
  const [reportConfig, setReportConfig] = useState({ enabled: false, day: 'MONDAY', time: '09:00' });

  // 1. POBIERANIE DANYCH
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
      setProfile(prev => ({ ...prev, firstName: user.firstName, lastName: user.lastName, email: user.email }));

      axios.get(`http://localhost:3000/api/users/${user.id}/settings`)
        .then(res => {
            if (res.data) {
                setEmailConfig({
                    enabled: res.data.emailEnabled ?? true,
                    days: res.data.emailDays ? res.data.emailDays.split(',') : ['MONDAY'],
                    time: res.data.emailTime || '08:00'
                });
                setReportConfig({
                    enabled: res.data.reportEnabled ?? false,
                    day: res.data.reportDay || 'MONDAY',
                    time: res.data.reportTime || '09:00'
                });
            }
        })
        .catch(err => console.error("Błąd pobierania ustawień:", err));
    }
  }, []);

  // 2. FUNKCJE ZAPISU I LOGIKI
  const saveAllSettings = async (newEmailConf: any, newReportConf: any) => {
      if (!userId) return;
      try {
          await axios.put(`http://localhost:3000/api/users/${userId}/settings`, {
              emailEnabled: newEmailConf.enabled,
              emailDays: newEmailConf.days.join(','),
              emailTime: newEmailConf.time,
              reportEnabled: newReportConf.enabled,
              reportDay: newReportConf.day,
              reportTime: newReportConf.time
          });
      } catch (e) { toast.error("Błąd zapisu ustawień"); }
  };

  const toggleEmailDay = (dayId: string) => {
      let newDays = [...emailConfig.days];
      if (newDays.includes(dayId)) newDays = newDays.filter(d => d !== dayId);
      else newDays.push(dayId);
      if(newDays.length === 0) { toast.error("Wybierz min. 1 dzień"); return; }
      const newState = { ...emailConfig, days: newDays };
      setEmailConfig(newState);
      saveAllSettings(newState, reportConfig);
  };

  const selectEveryDay = () => {
      const newState = { ...emailConfig, days: WEEK_DAYS.map(d => d.id) };
      setEmailConfig(newState);
      saveAllSettings(newState, reportConfig);
      toast.success("Ustawiono sprawdzanie codziennie");
  };

  const updateEmail = (key: string, val: any) => {
      const newState = { ...emailConfig, [key]: val };
      setEmailConfig(newState);
      saveAllSettings(newState, reportConfig);
      if(key === 'enabled') toast.success(val ? "Alerty włączone" : "Alerty wyłączone");
  };

  const handleTestAlert = async () => {
      if (!userId) return;
      setTestingAlert(true);
      try { 
          await axios.post('http://localhost:3000/api/alerts/test-now', { userId }); 
          toast.success("Wysłano żądanie sprawdzenia bazy."); 
      }
      catch { toast.error("Błąd połączenia z serwerem."); } 
      finally { setTestingAlert(false); }
  };

  const updateReport = (key: string, val: any) => {
      const newState = { ...reportConfig, [key]: val };
      setReportConfig(newState);
      saveAllSettings(emailConfig, newState);
      if(key === 'enabled') toast.success(val ? "Automat raportowy włączony" : "Automat wyłączony");
  };

  const handleGenerateReportNow = async () => {
      if (!userId) return;
      setGeneratingReport(true);
      try { await axios.post('http://localhost:3000/api/reports/generate-now', { userId }); toast.success("Raport wygenerowany!"); }
      catch { toast.error("Błąd generowania."); } finally { setGeneratingReport(false); }
  };

  // --- ZAPIS PROFILU ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!userId) return;
    // WALIDACJA EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
        toast.error('Podaj poprawny adres e-mail');
        setLoading(false);
        return;
    }
    try {
        const response = await axios.put(`http://localhost:3000/api/users/${userId}/profile`, {
            firstName: profile.firstName, lastName: profile.lastName, email: profile.email
        });
        if (response.data.success) {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const updatedUser = { ...currentUser, firstName: profile.firstName, lastName: profile.lastName, email: profile.email };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            toast.success('Dane profilowe zostały zapisane w bazie!');
            setTimeout(() => window.location.reload(), 1000);
        }
    } catch (error) { toast.error('Błąd zapisu danych w bazie.'); } finally { setLoading(false); }
  };

  // --- ZMIANA HASŁA (Z UKRYWANIEM/ODKRYWANIEM) ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.new !== passwords.confirm) { toast.error('Nowe hasła nie są identyczne'); return; }

    // Walidacja siły hasła
    const strongPasswordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>])[a-zA-Z0-9!@#$%^&*(),.?":{}|<>]{8,}$/;
    if (!strongPasswordRegex.test(passwords.new)) {
        toast.error('Hasło musi mieć min. 8 znaków, cyfrę i znak specjalny (!@#$%)'); 
        return;
    }

    setLoading(true);
    try {
        const response = await axios.put(`http://localhost:3000/api/users/${userId}/password`, {
            currentPassword: passwords.current,
            newPassword: passwords.new
        });
        if (response.data.success) {
            toast.success('Hasło zostało pomyślnie zmienione!');
            setPasswords({ current: '', new: '', confirm: '' });
        }
    } catch (error: any) {
        if (error.response && error.response.data && error.response.data.error) {
            toast.error(error.response.data.error);
        } else {
            toast.error('Błąd zmiany hasła.');
        }
    } finally { setLoading(false); }
  };

  // Funkcja pomocnicza do przełączania oczka
  const toggleVisibility = (field: 'current' | 'new' | 'confirm') => {
      setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-8 flex items-center gap-4">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">← Wróć</Link>
        <div><h1 className="text-3xl font-bold text-slate-800">Ustawienia</h1><p className="text-slate-500 mt-1">Zarządzaj swoim kontem i preferencjami aplikacji.</p></div>
      </header>

      <div className="space-y-6">

        {/* --- DANE OSOBOWE --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2"><User size={18} className="text-blue-600"/><h2 className="font-bold text-slate-700">Dane Osobowe</h2></div>
            <div className="p-6"><form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Imię</label><input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nazwisko</label><input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} /></div><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input type="email" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} /></div><div className="md:col-span-2 flex justify-end"><button disabled={loading} type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-70"><Save size={18} /> {loading ? 'Zapisywanie...' : 'Zapisz Zmiany'}</button></div></form></div>
        </div>

        {/* --- ZMIANA HASŁA (Z IKONKĄ OKA) --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2"><Lock size={18} className="text-blue-600"/><h2 className="font-bold text-slate-700">Zmiana Hasła</h2></div>
            <div className="p-6">
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    
                    {/* OBECNE HASŁO */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obecne hasło</label>
                        <div className="relative">
                            <input 
                                type={showPasswords.current ? "text" : "password"} 
                                required 
                                className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg outline-none focus:border-blue-500" 
                                value={passwords.current} 
                                onChange={e => setPasswords({...passwords, current: e.target.value})} 
                            />
                            <button 
                                type="button" 
                                onClick={() => toggleVisibility('current')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPasswords.current ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>

                    {/* NOWE HASŁO */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nowe hasło</label>
                        <div className="relative">
                            <input 
                                type={showPasswords.new ? "text" : "password"} 
                                required 
                                className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg outline-none focus:border-blue-500" 
                                value={passwords.new} 
                                onChange={e => setPasswords({...passwords, new: e.target.value})} 
                            />
                            <button 
                                type="button" 
                                onClick={() => toggleVisibility('new')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPasswords.new ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Min. 8 znaków, cyfra i znak specjalny.</p>
                    </div>

                    {/* POWTÓRZ HASŁO */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Powtórz nowe hasło</label>
                        <div className="relative">
                            <input 
                                type={showPasswords.confirm ? "text" : "password"} 
                                required 
                                className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg outline-none focus:border-blue-500" 
                                value={passwords.confirm} 
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})} 
                            />
                            <button 
                                type="button" 
                                onClick={() => toggleVisibility('confirm')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPasswords.confirm ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2"><button disabled={loading} type="submit" className="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-colors disabled:opacity-70">Zaktualizuj Hasło</button></div>
                </form>
            </div>
        </div>

        {/* --- POWIADOMIENIA --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Bell size={18} className="text-blue-600"/>
                <h2 className="font-bold text-slate-700">Powiadomienia i Raporty</h2>
            </div>
            <div className="p-6 space-y-8">
                
                {/* ALERTY EMAIL */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg mt-1"><Mail size={20}/></div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Alerty E-mail (Wygaśnięcia)</p>
                                <p className="text-xs text-slate-500">Wyślemy szybkie info, gdy wykryjemy problem (np. brak badań).</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={emailConfig.enabled} onChange={() => updateEmail('enabled', !emailConfig.enabled)} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                    </div>

                    {emailConfig.enabled && (
                        <div className="ml-12 bg-blue-50/50 rounded-xl p-5 border border-blue-100 animate-in slide-in-from-top-2">
                            <div className="mb-5">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2"><Calendar size={14}/> Dni sprawdzania</label>
                                    <button onClick={selectEveryDay} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                        <Check size={10}/> Zaznacz wszystkie
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {WEEK_DAYS.map(day => {
                                        const isActive = emailConfig.days.includes(day.id);
                                        return (
                                            <button key={day.id} onClick={() => toggleEmailDay(day.id)} className={`w-9 h-9 rounded-lg text-xs font-bold transition-all border ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                                                {day.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase mb-1 block"><Clock size={14} className="inline mr-1"/> Godzina</label>
                                    <select value={emailConfig.time} onChange={(e) => updateEmail('time', e.target.value)} className="p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none w-24">
                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <button onClick={handleTestAlert} disabled={testingAlert} className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors flex items-center gap-2">
                                    {testingAlert ? 'Wysyłanie...' : <><Play size={12}/> Wyślij test teraz</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <hr className="border-slate-100"/>

                {/* RAPORT TYGODNIOWY */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg mt-1"><FileText size={20}/></div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Raport Tygodniowy (Archiwizacja)</p>
                                <p className="text-xs text-slate-500">Generuj pełny raport PDF i zapisuj w historii.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={reportConfig.enabled} onChange={() => updateReport('enabled', !reportConfig.enabled)} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-green-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                    </div>

                    {reportConfig.enabled && (
                        <div className="ml-12 bg-green-50/50 rounded-xl p-5 border border-green-100 animate-in slide-in-from-top-2 flex flex-wrap gap-4 items-end justify-between">
                            <div className="flex gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Dzień</label>
                                    <select value={reportConfig.day} onChange={(e) => updateReport('day', e.target.value)} className="p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none w-32">
                                        {WEEK_DAYS.map(d => <option key={d.id} value={d.id}>{d.label} (Pełna)</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Godzina</label>
                                    <select value={reportConfig.time} onChange={(e) => updateReport('time', e.target.value)} className="p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none w-24">
                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleGenerateReportNow} disabled={generatingReport} className="text-xs font-bold text-green-700 bg-white border border-green-200 px-4 py-2.5 rounded-xl hover:bg-green-50 transition-colors flex items-center gap-2">
                                {generatingReport ? 'Generowanie...' : <><Play size={12}/> Generuj raport teraz</>}
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>

         <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Shield size={24} /></div>
            <div><h3 className="text-lg font-bold text-blue-900">Rola Administratora</h3><p className="text-sm text-blue-700 mt-1">Masz pełne uprawnienia do zarządzania pracownikami, dokumentami oraz konfiguracją systemu.</p></div>
         </div>

      </div>
    </div>
  );
}