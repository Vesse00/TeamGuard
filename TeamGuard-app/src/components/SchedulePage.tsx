import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar as CalIcon, Clock, ArrowRight, Settings, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

// --- KOMPONENT MODALU ZARZĄDZANIA ZMIANAMI ---
function ShiftsManagerModal({ onClose, onUpdate }: { onClose: () => void, onUpdate: () => void }) {
    const [shifts, setShifts] = useState<any[]>([]);
    const [newShift, setNewShift] = useState({ name: '', startTime: '08:00', endTime: '16:00' });

    const fetchShifts = () => axios.get('http://localhost:3000/api/shifts').then(res => setShifts(res.data));

    useEffect(() => { fetchShifts(); }, []);

    const handleAdd = async () => {
        if (!newShift.name) return toast.error('Podaj nazwę zmiany');
        try {
            await axios.post('http://localhost:3000/api/shifts', newShift);
            toast.success('Dodano zmianę');
            setNewShift({ name: '', startTime: '08:00', endTime: '16:00' });
            fetchShifts();
            onUpdate(); // Odśwież główny widok
        } catch (e) { toast.error('Błąd dodawania'); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Usunąć tę definicję zmiany?")) return;
        try {
            await axios.delete(`http://localhost:3000/api/shifts/${id}`);
            fetchShifts();
            onUpdate();
        } catch (e) { toast.error('Błąd usuwania'); }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
                
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Settings className="text-blue-600"/> Konfiguracja Zmian
                </h2>

                {/* Formularz dodawania */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nazwa</label>
                        <input type="text" placeholder="np. I Zmiana" className="border p-2 rounded-lg w-40 text-sm"
                            value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start</label>
                        <input type="time" className="border p-2 rounded-lg text-sm"
                            value={newShift.startTime} onChange={e => setNewShift({...newShift, startTime: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Koniec</label>
                        <input type="time" className="border p-2 rounded-lg text-sm"
                            value={newShift.endTime} onChange={e => setNewShift({...newShift, endTime: e.target.value})} />
                    </div>
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 text-sm">
                        <Plus size={16}/> Dodaj
                    </button>
                </div>

                {/* Lista zmian */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {shifts.length === 0 && <p className="text-slate-400 text-center text-sm">Brak zdefiniowanych zmian.</p>}
                    {shifts.map(shift => (
                        <div key={shift.id} className="bg-white p-3 rounded-lg border border-slate-100 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">{shift.name[0]}</div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{shift.name}</p>
                                    <p className="text-slate-500 text-xs font-mono">{shift.startTime} - {shift.endTime}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(shift.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// --- GŁÓWNY KOMPONENT STRONY ---
export function SchedulePage() {
  const [viewMode, setViewMode] = useState<'PLANNED' | 'REAL'>('PLANNED');
  const [employees, setEmployees] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isAdmin = currentUser?.role === 'ADMIN';

  const fetchData = async () => {
      try {
          if (isAdmin) {
             const empRes = await axios.get('http://localhost:3000/api/employees');
             setEmployees(empRes.data);
          } else {
             const empRes = await axios.get(`http://localhost:3000/api/employees/${currentUser.employeeId}`);
             setEmployees([empRes.data]);
          }
      } catch (e) { console.error("Błąd pobierania danych grafiku"); }
  };

  useEffect(() => { fetchData(); }, [isAdmin, currentUser]);

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CalIcon className="text-blue-600" /> Grafik Pracy
            </h1>
            <p className="text-slate-500 mt-1">Podgląd zmian i obecności na dzień dzisiejszy.</p>
        </div>
        
        <div className="flex items-center gap-4">
            {/* Przełącznik Trybu */}
            <div className="bg-slate-200 p-1 rounded-xl flex gap-1">
                <button onClick={() => setViewMode('PLANNED')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'PLANNED' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Planowany
                </button>
                <button onClick={() => setViewMode('REAL')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'REAL' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Rzeczywisty
                </button>
            </div>

            {/* Guzik Admina */}
            {isAdmin && (
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
                >
                    <Settings size={18} /> <span className="hidden sm:inline">Edytuj Zmiany</span>
                </button>
            )}
        </div>
      </div>

      {/* LISTA PRACOWNIKÓW */}
      <div className="grid gap-4">
          {employees.map(emp => {
              // Logika dla widoku Rzeczywistego (szukamy ostatniego loga dzisiaj)
              const lastLog = emp.workLogs && emp.workLogs.length > 0 ? emp.workLogs[0] : null;
              const isWorkingNow = lastLog && !lastLog.endedAt;
              
              return (
                <div key={emp.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        
                        {/* Dane Pracownika */}
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${isWorkingNow ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500'}`}>
                                {emp.avatarInitials}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{emp.firstName} {emp.lastName}</h3>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{emp.position}</span>
                                    <span>•</span>
                                    <span>{emp.department?.name || 'Brak działu'}</span>
                                </div>
                            </div>
                        </div>

                        {/* SEKCJA GRAFIKU */}
                        <div className="flex-1 w-full md:w-auto flex justify-center md:justify-end">
                            {viewMode === 'PLANNED' ? (
                                // --- WIDOK PLANOWANY ---
                                emp.shift ? (
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Przypisana Zmiana</p>
                                        <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 text-blue-700">
                                            <span className="font-bold">{emp.shift.name}</span>
                                            <div className="h-4 w-px bg-blue-200"></div>
                                            <span className="font-mono font-bold flex items-center gap-1">
                                                {emp.shift.startTime} <ArrowRight size={14} className="opacity-50"/> {emp.shift.endTime}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm italic">
                                        Brak przypisanej zmiany
                                    </div>
                                )
                            ) : (
                                // --- WIDOK RZECZYWISTY (RCP) ---
                                lastLog ? (
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status RCP (Ostatnie odbicie)</p>
                                        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${isWorkingNow ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            <div className={`w-2 h-2 rounded-full ${isWorkingNow ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                            <span className="font-bold">{isWorkingNow ? 'W Pracy' : 'Poza Pracą'}</span>
                                            <div className="h-4 w-px bg-current opacity-20"></div>
                                            <span className="font-mono text-sm">
                                                Start: {new Date(lastLog.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm">
                                        Brak aktywności dzisiaj
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
              );
          })}
      </div>

      {/* Modal */}
      {isModalOpen && <ShiftsManagerModal onClose={() => setIsModalOpen(false)} onUpdate={fetchData} />}
    </div>
  );
}