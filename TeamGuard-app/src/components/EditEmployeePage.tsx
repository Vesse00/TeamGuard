import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, Plus, Trash2, Calendar, ShieldAlert, Pencil, X, Check, Clock, RefreshCw, CalendarCheck, Briefcase, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface Compliance {
  id: number;
  name: string;
  expiryDate: string;
  issueDate: string;
  duration: string;
  status: string;
  type: string;
}

interface Department {
    id: number;
    name: string;
}

const getAdminId = () => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u).id : null;
};

const COMPLIANCE_CATEGORIES: Record<string, string[]> = {
    'MANDATORY': ['Badania Lekarskie', 'Szkolenie BHP'],
    'UDT': ['Wózki jezdniowe (widłowe)', 'Podesty ruchome (zwyżki)', 'Żurawie (samojezdne, HDS, wieżowe)', 'Suwnice, wciągniki i wciągarki', 'Dźwigi (windy)', 'Układnice magazynowe', 'Urządzenia załadowcze/wyładowcze', 'Napełnianie/opróżnianie zbiorników (UNO)', 'Personel NDT (Badania nieniszczące)', 'Spawacz / Połączenia nierozłączne', 'Konserwator urządzeń UDT'],
    'SEP': ['G1 - Elektryczne (Eksploatacja)', 'G1 - Elektryczne (Dozór)', 'G2 - Cieplne (Eksploatacja)', 'G2 - Cieplne (Dozór)', 'G3 - Gazowe (Eksploatacja)', 'G3 - Gazowe (Dozór)'],
    'DRIVING': ['Prawo Jazdy Kat. B', 'Prawo Jazdy Kat. B+E', 'Prawo Jazdy Kat. C', 'Prawo Jazdy Kat. C+E', 'Prawo Jazdy Kat. D', 'Prawo Jazdy Kat. D+E', 'Prawo Jazdy Kat. T (Ciągnik)', 'Karta Kierowcy', 'Kwalifikacja Zawodowa (Kod 95)'],
    'OTHER': []
};

const DURATION_OPTIONS: Record<string, { value: string; label: string }[]> = {
    'BHP': [{ value: '0.5', label: '6 miesięcy (Wstępne)' }, { value: '1', label: '1 rok (Stan. robotnicze)' }, { value: '3', label: '3 lata (Stan. biurowe/inż.)' }, { value: '5', label: '5 lat (Kierownicy/Pracodawcy)' }],
    'MEDICAL': [{ value: '1', label: '1 rok' }, { value: '2', label: '2 lata' }, { value: '3', label: '3 lata' }, { value: '4', label: '4 lata' }],
    'UDT': [{ value: '5', label: '5 lat (Standard)' }, { value: '10', label: '10 lat (Niektóre wózki/podesty)' }],
    'SEP': [{ value: '5', label: '5 lat' }],
    'DRIVING': [{ value: '5', label: '5 lat (Zawodowe C/D)' }, { value: '15', label: '15 lat (Amatorskie B/T)' }],
    'OTHER': [{ value: '1', label: '1 rok' }, { value: '2', label: '2 lata' }, { value: '3', label: '3 lata' }, { value: '5', label: '5 lat' }, { value: '10', label: '10 lat' }]
};

const CATEGORY_LABELS: Record<string, string> = {
    'MANDATORY': 'Obowiązkowe (BHP/Badania)',
    'UDT': 'Uprawnienia UDT',
    'SEP': 'Uprawnienia SEP',
    'DRIVING': 'Kierowca / Uprawnienia Jazdy',
    'OTHER': 'Inne'
};

export function EditEmployeePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  //lista działów do selecta
  const [departments, setDepartments] = useState<Department[]>([]);

  const [formData, setFormData] = useState({ firstName: '', lastName: '', position: '', email: '', hiredAt: '', departmentId: '' });
  const [compliances, setCompliances] = useState<Compliance[]>([]);

 
  
  const [newCompliance, setNewCompliance] = useState({
    category: 'UDT', 
    details: COMPLIANCE_CATEGORIES['UDT'][0],
    customDetails: '',
    issueDate: new Date().toISOString().split('T')[0],
    duration: '5'
  });

  const [editingState, setEditingState] = useState<{ id: number | null; issueDate: string; duration: string; }>({ id: null, issueDate: '', duration: '5' });

  const getIconColorClass = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return 'bg-red-50 text-red-600';
    if (daysLeft <= 30) return 'bg-orange-50 text-orange-600';
    return 'bg-blue-50 text-blue-600';
  };

  const getDurationOptionsFor = (category: string, detailName: string) => {
    if (detailName === 'Szkolenie BHP') return DURATION_OPTIONS['BHP'];
    if (detailName === 'Badania Lekarskie') return DURATION_OPTIONS['MEDICAL'];
    return DURATION_OPTIONS[category] || DURATION_OPTIONS['OTHER'];
  };

  const calculateExpiry = (start: string, durationStr: string) => {
      if(!start) return '';
      const date = new Date(start);
      if (durationStr === '0.5') date.setMonth(date.getMonth() + 6);
      else date.setFullYear(date.getFullYear() + parseInt(durationStr));
      return date.toISOString().split('T')[0];
  };

  const fetchData = async () => {
    try {
      // ZMIANA: Pobieramy dane pracownika I listę działów równocześnie
      const [empRes, deptRes] = await Promise.all([
          axios.get(`http://localhost:3000/api/employees/${id}`),
          axios.get('http://localhost:3000/api/departments')
      ]);

      setDepartments(deptRes.data);

      setFormData({
        firstName: empRes.data.firstName, 
        lastName: empRes.data.lastName, 
        position: empRes.data.position, 
        // Ustawiamy ID działu, jeśli istnieje
        departmentId: empRes.data.department?.id || '',
        email: empRes.data.email || '', 
        hiredAt: new Date(empRes.data.hiredAt).toISOString().split('T')[0]
      });

      setCompliances(empRes.data.compliance);
      setLoading(false);
    } catch (error) { toast.error('Błąd pobierania danych'); navigate('/employees'); }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:3000/api/employees/${id}`, {
        ...formData,
        departmentId: formData.departmentId ? Number(formData.departmentId) : null,
        adminId: getAdminId()
      }
        
      );
      toast.success('Dane personalne zaktualizowane');
    } catch (error) { toast.error('Błąd zapisu profilu'); }
  };

  const handleCategoryChange = (category: string) => {
      const defaultDetail = COMPLIANCE_CATEGORIES[category]?.[0] || '';
      const validDurations = getDurationOptionsFor(category, defaultDetail);
      setNewCompliance({ ...newCompliance, category, details: defaultDetail, customDetails: '', duration: validDurations[0].value });
  };
  const handleDetailChange = (detail: string) => {
      const validDurations = getDurationOptionsFor(newCompliance.category, detail);
      setNewCompliance({ ...newCompliance, details: detail, duration: validDurations[0].value });
  };
  const handleAddCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = newCompliance.category === 'OTHER' ? newCompliance.customDetails : newCompliance.details;
    const calculatedExpiryDate = calculateExpiry(newCompliance.issueDate, newCompliance.duration);
    if (!finalName) { toast.error('Wpisz nazwę uprawnienia!'); return; }
    if (!newCompliance.issueDate) { toast.error('Podaj datę uzyskania!'); return; }
    try {
      await axios.post('http://localhost:3000/api/compliance', {
        employeeId: id, name: finalName, type: newCompliance.category, expiryDate: calculatedExpiryDate, status: 'VALID', issueDate: new Date(newCompliance.issueDate).toISOString(), duration: newCompliance.duration, adminId: getAdminId()
      });
      toast.success('Dodano uprawnienie');
      fetchData();
    } catch (error) { toast.error('Błąd dodawania'); }
  };

  // --- LOGIKA ODNOWIENIA ---
  const executeRenew = async (item: Compliance) => {
    const today = new Date().toISOString().split('T')[0];
    const durationToUse = item.duration || '1'; 
    const newExpiry = calculateExpiry(today, durationToUse);
    try {
        await axios.put(`http://localhost:3000/api/compliance/${item.id}`, { issueDate: new Date(today).toISOString(), expiryDate: newExpiry, duration: durationToUse,  });
        toast.success('Uprawnienie zostało pomyślnie odnowione!');
        fetchData();
    } catch (error) { toast.error('Błąd odnawiania'); }
  };

  // --- LOGIKA USUWANIA ---
  const executeDeleteCompliance = async (complianceId: number) => {
    const currentAdminId = getAdminId(); // Pobierz ID admina
    try {
      await axios.delete(`http://localhost:3000/api/compliance/${complianceId}?adminId=${currentAdminId}`); // Przekaż ID admina w zapytaniu
      toast.success('Usunięto uprawnienie');
      setCompliances(prev => prev.filter(c => c.id !== complianceId));
    } catch (error) { toast.error('Błąd usuwania'); }
  };

  // --- MODAL USUWANIA (TOAST) ---
  const handleDeleteClick = (complianceId: number) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm">
        <div className="flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-full">
                <Trash2 size={24} />
            </div>
            <div>
                <h3 className="text-lg font-bold text-slate-800">Usunąć uprawnienie?</h3>
                <p className="text-sm text-slate-500 mt-1">Czy na pewno chcesz usunąć ten certyfikat z profilu pracownika?</p>
            </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={() => toast.dismiss(t)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Anuluj</button>
          <button onClick={() => { toast.dismiss(t); executeDeleteCompliance(complianceId); }} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-200 transition-colors">Usuń</button>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  };

  // --- MODAL ODNOWIENIA (TOAST) ---
  const handleRenewClick = (item: Compliance) => {
    const durationLabel = item.duration === '0.5' ? '6 miesięcy' : `${item.duration} lat(a)`;
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm">
        <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><RefreshCw size={24} /></div>
            <div>
                <h3 className="text-lg font-bold text-slate-800">Odnowić uprawnienie?</h3>
                <p className="text-sm text-slate-500 mt-1">Czy chcesz odnowić <strong>{item.name}</strong> od dzisiaj?</p>
                <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 inline-flex px-2 py-1 rounded items-center gap-1"><CalendarCheck size={12}/> Nowy okres ważności: {durationLabel}</div>
            </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={() => toast.dismiss(t)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Anuluj</button>
          <button onClick={() => { toast.dismiss(t); executeRenew(item); }} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-colors">Potwierdź</button>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  };

  const startEditing = (comp: Compliance) => {
    const issue = comp.issueDate ? new Date(comp.issueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const dur = comp.duration || '1';
    setEditingState({ id: comp.id, issueDate: issue, duration: dur });
  };
  const saveEditing = async () => {
    if (!editingState.id) return;
    const newExpiryDate = calculateExpiry(editingState.issueDate, editingState.duration);
    try {
        await axios.put(`http://localhost:3000/api/compliance/${editingState.id}`, { 
            expiryDate: newExpiryDate, issueDate: new Date(editingState.issueDate).toISOString(), duration: editingState.duration
        });
        toast.success(`Zaktualizowano ważność`);
        setEditingState({ id: null, issueDate: '', duration: '' });
        fetchData(); 
    } catch (error) { toast.error('Błąd aktualizacji'); }
  };

  if (loading) return <div className="p-10">Ładowanie...</div>;
  const currentDurationOptions = getDurationOptionsFor(newCompliance.category, newCompliance.details);

  return (
    <div className="max-w-5xl mx-auto pb-20">
      
      <div className="flex items-center gap-4 mb-8">
        <Link to={`/employees/${id}`} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Edycja Pracownika</h1>
          <p className="text-slate-500">Zarządzaj danymi osobowymi i certyfikatami</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEWA STRONA (Formularz) */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Save size={18} className="text-blue-600"/> Dane Podstawowe
            </h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Imię</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nazwisko</label>
                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Stanowisko</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                      name="position"
                      value={formData.position}
                      onChange={e => setFormData({ ...formData, position: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Dział</label>
                  <div className="relative">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    name="departmentId"
                    value={formData.departmentId}
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full pl-10 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Brak działu --</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                  </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <button type="submit" className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors">Zapisz Zmiany</button>
            </form>
          </div>
        </div>

        {/* PRAWA STRONA */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* DODAWANIE */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-green-600"/> Dodaj Nowe Uprawnienie
            </h2>
            
            <form onSubmit={handleAddCompliance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kategoria</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 outline-none" 
                    value={newCompliance.category} onChange={e => handleCategoryChange(e.target.value)}>
                    {Object.keys(CATEGORY_LABELS).filter(key => key !== 'MANDATORY').map(k => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Szczegóły</label>
                {newCompliance.category === 'OTHER' ? (
                    <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg" placeholder="Nazwa..." value={newCompliance.customDetails} onChange={e => setNewCompliance({...newCompliance, customDetails: e.target.value})} />
                ) : (
                    <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white" value={newCompliance.details} onChange={e => handleDetailChange(e.target.value)}> 
                        {COMPLIANCE_CATEGORIES[newCompliance.category].map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                )}
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Uzyskania</label>
                <input type="date" className="w-full p-2.5 border border-slate-300 rounded-lg" value={newCompliance.issueDate} onChange={e => setNewCompliance({...newCompliance, issueDate: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ważne przez</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500 transition-all" value={newCompliance.duration} onChange={e => setNewCompliance({...newCompliance, duration: e.target.value})}>
                    {currentDurationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="col-span-1 md:col-span-2 mt-2">
                 <button type="submit" className="w-full py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                    <Plus size={18} /> Dodaj (Ważne do: {calculateExpiry(newCompliance.issueDate, newCompliance.duration)})
                </button>
              </div>
            </form>
          </div>

          {/* LISTA UPRAWNIEŃ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700">Aktywne Uprawnienia</h3>
            </div>
            
            <div className="divide-y divide-slate-100">
              {compliances.map((item) => {
                const editDurationOptions = getDurationOptionsFor(item.type, item.name);
                const iconColorClass = getIconColorClass(item.expiryDate);
                const isMandatory = item.type === 'MANDATORY' || item.name === 'Szkolenie BHP' || item.name === 'Badania Lekarskie';
                const isWarningOrExpired = getIconColorClass(item.expiryDate) !== 'bg-blue-50 text-blue-600';

                return (
                <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors group gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${iconColorClass}`}>
                      <ShieldAlert size={20} />
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-bold text-slate-800">{item.name}</p>
                      
                      {editingState.id === item.id ? (
                          <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                              <div className="flex flex-wrap gap-3 items-end">
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Od kiedy (data nowa)</label>
                                      <input type="date" className="p-1.5 border border-blue-300 rounded bg-white text-xs font-medium focus:ring-2 ring-blue-200 outline-none" 
                                        value={editingState.issueDate} onChange={(e) => setEditingState({...editingState, issueDate: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Na ile lat</label>
                                      <select className="p-1.5 border border-blue-300 rounded bg-white text-xs font-medium focus:ring-2 ring-blue-200 outline-none w-48"
                                        value={editingState.duration} onChange={(e) => setEditingState({...editingState, duration: e.target.value})}>
                                          {editDurationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                      </select>
                                  </div>
                                  <div className="flex gap-2 pb-0.5">
                                      <button onClick={saveEditing} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm"><Check size={14}/> Zapisz</button>
                                      <button onClick={() => setEditingState({id: null, issueDate: '', duration: ''})} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded text-xs font-bold hover:bg-slate-50 flex items-center gap-1"><X size={14}/> Anuluj</button>
                                  </div>
                              </div>
                              <p className="text-[10px] text-blue-600 font-bold mt-2 flex items-center gap-1"><Clock size={12}/> Nowa ważność do: {calculateExpiry(editingState.issueDate, editingState.duration)}</p>
                          </div>
                      ) : (
                          <div className="flex gap-3 text-sm text-slate-500 mt-0.5 items-center">
                              <span className="bg-slate-100 px-2 rounded text-xs font-bold uppercase tracking-wide text-slate-600">{item.type === 'MANDATORY' ? 'OBOWIĄZKOWE' : (item.type || 'INNE')}</span>
                              <span className="flex items-center gap-1 font-medium">
                                  <Calendar size={14} className="text-slate-400"/> Ważne do: <span className="text-slate-700">{new Date(item.expiryDate).toLocaleDateString()}</span>
                              </span>
                          </div>
                      )}
                    </div>
                  </div>
                  
                  {editingState.id !== item.id && (
                      <div className="flex items-center gap-1 pl-4 border-l border-slate-100">
                        {/* GUZIK ODNOWIENIA - Teraz z Toastem! */}
                        {isWarningOrExpired && (
                            <button onClick={() => handleRenewClick(item)} className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-colors mr-1" title="Odnów automatycznie od dzisiaj">
                                <RefreshCw size={18} />
                            </button>
                        )}
                        <button onClick={() => startEditing(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group-hover:bg-white" title="Zmień okres ważności">
                            <Pencil size={18} />
                        </button>
                        
                        {!isMandatory && (
                            <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors group-hover:bg-white" title="Usuń">
                                <Trash2 size={18} />
                            </button>
                        )}
                      </div>
                  )}
                </div>
              )})}
              {compliances.length === 0 && <div className="p-6 text-center text-slate-400">Brak uprawnień.</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}