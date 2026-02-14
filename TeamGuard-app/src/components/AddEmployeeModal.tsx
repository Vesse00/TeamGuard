import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Calendar, ShieldCheck, Stethoscope, ChevronDown, UserPlus, Briefcase, Building, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Department {
    id: number;
    name: string;
}

interface Shift {
    id: number;
    name: string;
    departmentId: number | null;
}

export function AddEmployeeModal({ isOpen, onClose, onSuccess }: Props) {
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  const getToday = () => new Date().toISOString().split('T')[0];

  const calculateEndDate = (startDateStr: string, durationStr: string) => {
    if (!startDateStr) return '';
    const date = new Date(startDateStr);
    if (durationStr === '0.5') {
        date.setMonth(date.getMonth() + 6);
    } else {
        date.setFullYear(date.getFullYear() + parseInt(durationStr));
    }
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    email: '',
    departmentId: '',
    hiredAt: getToday(),
    bhpStartDate: getToday(),
    bhpDuration: '0.5',
    medicalStartDate: getToday(),
    medicalDuration: '2',
    shiftId: '',
  });

  useEffect(() => {
      if (isOpen) {
          axios.get('http://localhost:3000/api/departments')
              .then(res => setDepartments(res.data))
              .catch(err => console.error("Błąd pobierania działów", err));
          axios.get('http://localhost:3000/api/shifts')
            .then(res => setShifts(res.data));
      }
  }, [isOpen]);

  // --- POPRAWIONE FILTROWANIE (ŚCISŁE) ---
  const filteredShifts = shifts.filter(shift => {
      // Jeśli nie wybrano działu, pokazujemy wszystkie (żeby można było wybrać cokolwiek)
      if (!formData.departmentId) return true;
      
      // Jeśli wybrano dział, pokazujemy TYLKO zmiany tego działu.
      // USUNIĘTO: || shift.departmentId === null (Zmiany ogólne też znikają)
      return shift.departmentId === Number(formData.departmentId);
  });

  const handleNameChange = (field: 'firstName' | 'lastName', value: string) => {
    const capitalized = value.length > 0 
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;
    setFormData(prev => ({ ...prev, [field]: capitalized }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const userStr = localStorage.getItem('user');
    const adminId = userStr ? JSON.parse(userStr).id : null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        toast.error('Nieprawidłowy format adresu e-mail (np. jan@firma.pl).');
        setLoading(false);
        return;
    }

    try {
      await axios.post('http://localhost:3000/api/employees', {
        ...formData,
        departmentId: formData.departmentId ? Number(formData.departmentId) : undefined,
        shiftId: formData.shiftId ? Number(formData.shiftId) : undefined,
        adminId,
      });
      setLoading(false);
      onSuccess();
      onClose();
      toast.success('Pomyślnie dodano nowego pracownika!');
      
      setFormData({
        firstName: '', lastName: '', position: '', email: '',
        hiredAt: getToday(), 
        bhpStartDate: getToday(), 
        bhpDuration: '0.5',
        medicalStartDate: getToday(), 
        departmentId: '',
        medicalDuration: '2',
        shiftId: '',
      });
      setIsPermissionsOpen(false);
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.error || 'Nie udało się dodać pracownika. Sprawdź połączenie.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      
      <div style={{ width: '100%', maxWidth: '800px' }} 
        className="bg-white rounded-2xl shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
        
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/60 flex flex-col items-center rounded-t-2xl">
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 shadow-sm ring-4 ring-white shrink-0">
                <UserPlus size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Nowy Pracownik</h2>
            <p className="text-slate-500 mt-1 font-medium">Wprowadź dane personalne i zatrudnienia</p>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Imię</label>
                <input 
                  required type="text" placeholder="Jan"
                  className="w-full h-12 border border-slate-300 rounded-xl px-4 text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:font-normal"
                  value={formData.firstName}
                  onChange={e => handleNameChange('firstName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Nazwisko</label>
                <input 
                  required type="text" placeholder="Kowalski"
                  className="w-full h-12 border border-slate-300 rounded-xl px-4 text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:font-normal"
                  value={formData.lastName}
                  onChange={e => handleNameChange('lastName', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Briefcase size={12} /> Stanowisko
                    </label>
                    <input 
                        required 
                        value={formData.position}
                        onChange={e => setFormData({...formData, position: e.target.value})}
                        className="w-full p-3  border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-colors"
                        placeholder="Magazynier"
                    />
                </div>
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Building size={12} /> Dział
                    </label>
                    <select 
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium appearance-none cursor-pointer"
                            value={formData.departmentId}
                            onChange={e => setFormData({
                                ...formData, 
                                departmentId: e.target.value,
                                shiftId: '' // Reset
                            })}
                        >
                            <option value="">-- Wybierz --</option>
                            {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                    </select>
                </div>
            </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Data zatrudnienia</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input required type="date" name="hiredAt" value={formData.hiredAt} onChange={e => setFormData({...formData, hiredAt: e.target.value})} className="w-full p-3 pl-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none transition-all text-sm" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Zmiana (Grafik)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-slate-400" size={18} />
                    <select 
                        required 
                        name="shiftId" 
                        value={formData.shiftId} 
                        onChange={e => setFormData({...formData, shiftId: e.target.value})} 
                        className="w-full p-3 pl-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm appearance-none"
                    >
                      <option value="">Wybierz</option>
                      {/* Tutaj mapujemy filteredShifts */}
                      {filteredShifts.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Adres E-mail</label>
              <input 
                required type="email" placeholder="przyklad@firma.pl"
                className="w-full h-12 border border-slate-300 rounded-xl px-4 text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            

            <div className="border-t border-slate-100 my-6"></div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30 mb-6 mt-6">
                <button 
                    type="button" 
                    onClick={() => setIsPermissionsOpen(!isPermissionsOpen)}
                    className="w-full flex items-center justify-between pl-2 pr-6 py-2 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 my-1 rounded-lg transition-colors ${isPermissionsOpen ? 'bg-blue-100 text-blue-600' : 'bg-white text-slate-400 border border-slate-200 shadow-sm'}`}>
                            <ShieldCheck size={20}/>
                        </div>
                        <div className="text-left">
                            <span className={`block text-sm font-bold transition-colors ${isPermissionsOpen ? 'text-blue-700' : 'text-slate-700'}`}>
                                Uprawnienia startowe
                            </span>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5 group-hover:text-slate-500">
                                {isPermissionsOpen ? 'Kliknij, aby zwinąć sekcję' : 'Kliknij, aby skonfigurować daty i ważność'}
                            </span>
                        </div>
                    </div>
                    <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${isPermissionsOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>

                {isPermissionsOpen && (
                    <div className="p-6 bg-white border-t border-slate-100 animate-in slide-in-from-top-1 fade-in duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                                    <ShieldCheck size={14} className="text-orange-500"/> Ważność BHP
                                </label>
                                <div className="grid grid-cols-4 gap-3">
                                    <input type="date" 
                                        className="col-span-3 h-11 bg-slate-50 border border-slate-300 rounded-lg px-3 text-sm font-medium outline-none focus:border-blue-500 transition-all text-slate-700 cursor-pointer"
                                        value={formData.bhpStartDate} onChange={e => setFormData({...formData, bhpStartDate: e.target.value})} 
                                    />
                                    <select
                                        className="col-span-1 h-11 bg-slate-50 border border-slate-300 rounded-lg px-3 text-sm font-medium outline-none focus:border-blue-500 transition-all text-slate-700 cursor-pointer"
                                        value={formData.bhpDuration} onChange={e => setFormData({...formData, bhpDuration: e.target.value})}
                                    >
                                        <option value="0.5">6 mies. (Wstępne)</option>
                                        <option value="1">1 rok</option>
                                        <option value="2">2 lata</option>
                                        <option value="3">3 lata</option>
                                        <option value="5">5 lat</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                                    <Stethoscope size={14} className="text-green-500"/> Ważność Badań
                                </label>
                                <div className="grid grid-cols-4 gap-3">
                                    <input type="date" 
                                        className="col-span-3 h-11 bg-slate-50 border border-slate-300 rounded-lg px-3 text-sm font-medium outline-none focus:border-blue-500 transition-all text-slate-700 cursor-pointer"
                                        value={formData.medicalStartDate} onChange={e => setFormData({...formData, medicalStartDate: e.target.value})} 
                                    />
                                    <select
                                        className="col-span-1 h-11 bg-slate-50 border border-slate-300 rounded-lg px-3 text-sm font-medium outline-none focus:border-blue-500 transition-all text-slate-700 cursor-pointer"
                                        value={formData.medicalDuration} onChange={e => setFormData({...formData, medicalDuration: e.target.value})}
                                    >
                                        <option value="1">1 rok</option>
                                        <option value="2">2 lata</option>
                                        <option value="3">3 lata</option>
                                        <option value="5">5 lat</option>
                                    </select>
                                </div>
                            </div>

                        </div>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
                            <p className="text-xs text-blue-600 font-medium">
                                Wybór "6 miesięcy" automatycznie doda pół roku do daty startu.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 h-12 border-2 border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transition-all text-sm">
                Anuluj
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 h-12 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 transition-all text-sm disabled:opacity-70 flex justify-center items-center gap-2">
                {loading ? 'Zapisywanie...' : 'Zapisz Pracownika'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}