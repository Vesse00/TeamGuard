import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Clock, Users, GripVertical, AlertCircle, Calendar, Filter, Settings, 
    ChevronLeft, ChevronRight, ArrowDownToLine, Plus, X, Pencil, Trash2, Save 
} from 'lucide-react';

// --- TYPY ---
interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    position: string;
    email: string;
    departmentId: number | null;
    shiftId: number | null;
    hiredAt: string;
    department?: { name: string };
    shift?: { name: string; startTime: string; endTime: string };
    avatarInitials?: string;
}

interface Shift {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
}

const getAdminId = () => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u).id : null;
};

export function SchedulePage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Drag & Drop
    const [draggedEmpId, setDraggedEmpId] = useState<number | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState<number | 'unassigned' | 'floating-unassigned' | null>(null);

    // Modal
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    // Scroll Ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        try {
            const [empRes, shiftRes] = await Promise.all([
                axios.get('http://localhost:3000/api/employees'),
                axios.get('http://localhost:3000/api/shifts')
            ]);
            setEmployees(empRes.data);
            const sortedShifts = shiftRes.data.sort((a: Shift, b: Shift) => 
                a.startTime.localeCompare(b.startTime)
            );
            setShifts(sortedShifts);
            setLoading(false);
        } catch (error) {
            toast.error("Błąd pobierania danych");
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- LOGIKA SCROLLA ---
    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = 300; // Szerokość kolumny (280px) + gap (20px)
            current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // --- LOGIKA DRAG & DROP ---
    const handleDragStart = (empId: number) => { setDraggedEmpId(empId); };
    
    const handleDragOver = (e: React.DragEvent, shiftId: number | 'unassigned' | 'floating-unassigned') => {
        e.preventDefault();
        if (isDraggingOver !== shiftId) setIsDraggingOver(shiftId);
    };

    const handleDrop = async (targetShiftId: number | null) => {
        setIsDraggingOver(null);
        if (!draggedEmpId) return;
        
        const emp = employees.find(e => e.id === draggedEmpId);
        if (!emp || emp.shiftId === targetShiftId) {
            setDraggedEmpId(null);
            return;
        }

        const previousEmployees = [...employees];
        setEmployees(prev => prev.map(e => e.id === draggedEmpId ? { ...e, shiftId: targetShiftId } : e));

        try {
            await axios.put(`http://localhost:3000/api/employees/${emp.id}`, {
                ...emp, shiftId: targetShiftId, adminId: getAdminId()
            });
            
            const shiftName = targetShiftId 
                ? shifts.find(s => s.id === targetShiftId)?.name 
                : "Nieprzypisani";
            
            toast.success(`Przeniesiono do: ${shiftName}`);
        } catch (error) {
            toast.error("Błąd zapisu. Cofam zmiany.");
            setEmployees(previousEmployees);
        } finally {
            setDraggedEmpId(null);
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Ładowanie grafiku...</div>;

    const unassignedEmployees = employees.filter(e => !e.shiftId);
    
    return (
        <div className="flex flex-col h-[calc(100vh-120px)] w-full max-w-full relative overflow-hidden">
            
            {/* HEADER */}
            <div className="flex justify-between items-center mb-4 px-1 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-blue-600"/> Zarządzanie Grafikiem
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Przeciągaj pracowników między kolumnami.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsManageModalOpen(true)} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
                        <Settings size={16}/> Zarządzaj Zmianami
                    </button>
                </div>
            </div>

            {/* --- GŁÓWNY UKŁAD (STAŁY LEWY + PRZEWIJANY PRAWY) --- */}
            <div className="flex-1 flex gap-6 overflow-hidden pb-2 w-full">
                
                {/* 1. LEWA STRONA: NIEPRZYPISANI (Sidebar - zawsze widoczny, stała szerokość) */}
                <div 
                    onDragOver={(e) => handleDragOver(e, 'unassigned')}
                    onDrop={() => handleDrop(null)}
                    className={`w-[260px] flex-shrink-0 flex flex-col rounded-xl border-2 transition-all duration-200 bg-white border-slate-200 shadow-sm ${
                        isDraggingOver === 'unassigned' ? 'border-blue-400 bg-blue-50/30' : ''
                    }`}
                >
                    {/* Header */}
                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 rounded-t-xl flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-slate-200 rounded-lg text-slate-600"><AlertCircle size={16} /></div>
                            <div>
                                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Nieprzypisani</h3>
                            </div>
                        </div>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 border border-slate-200">{unassignedEmployees.length}</span>
                    </div>
                    {/* List */}
                    <div className="flex-1 p-2 overflow-y-auto space-y-2 custom-scrollbar">
                        {unassignedEmployees.map(emp => <EmployeeCard key={emp.id} employee={emp} onDragStart={() => handleDragStart(emp.id)} mini />)}
                        {unassignedEmployees.length === 0 && <div className="h-20 flex items-center justify-center text-slate-300 text-xs italic">Pusto</div>}
                    </div>
                </div>

                {/* 2. PRAWA STRONA: ZMIANY (Kontener elastyczny w-0 zapobiega rozpychaniu strony) */}
                <div className="flex-1 w-0 relative flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/50 p-2">
                    
                    {/* STRZAŁKI NAWIGACYJNE */}
                    {shifts.length > 0 && (
                        <>
                            <button 
                                onClick={() => scroll('left')} 
                                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-lg text-slate-600 hover:text-blue-600 hover:scale-110 transition-all "
                                title="Przewiń w lewo"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button 
                                onClick={() => scroll('right')} 
                                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-lg text-slate-600 hover:text-blue-600 hover:scale-110 transition-all "
                                title="Przewiń w prawo"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </>
                    )}

                    {/* KONTENER PRZEWIJANIA (Overflow Auto) */}
                    <div 
                        ref={scrollContainerRef}
                        className="flex gap-5 h-full overflow-x-auto px-6 pb-2 no-scrollbar snap-x snap-mandatory scroll-smooth items-start w-full"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {shifts.map(shift => {
                            const shiftEmployees = employees.filter(e => e.shiftId === shift.id);
                            const isOver = isDraggingOver === shift.id;
                            return (
                                <div 
                                    key={shift.id}
                                    onDragOver={(e) => handleDragOver(e, shift.id)}
                                    onDrop={() => handleDrop(shift.id)}
                                    className={`w-[280px] flex-shrink-0 snap-start flex flex-col rounded-xl transition-all duration-200 border-2 h-full bg-white shadow-sm ${
                                        isOver ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                                    }`}
                                >
                                    <div className={`p-3 border-b rounded-t-xl flex justify-between items-center sticky top-0 z-10 bg-white ${isOver ? 'bg-blue-50' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${isOver ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}><Clock size={16} /></div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide truncate max-w-[140px]" title={shift.name}>{shift.name}</h3>
                                                <span className={`text-[10px] font-mono font-medium ${isOver ? 'text-blue-700' : 'text-slate-500'}`}>{shift.startTime} - {shift.endTime}</span>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{shiftEmployees.length}</span>
                                    </div>
                                    <div className="flex-1 p-2 overflow-y-auto space-y-2 custom-scrollbar">
                                        {shiftEmployees.map(emp => <EmployeeCard key={emp.id} employee={emp} onDragStart={() => handleDragStart(emp.id)} />)}
                                        {shiftEmployees.length === 0 && <div className="h-full flex items-center justify-center text-slate-300 text-xs italic">Przeciągnij tutaj</div>}
                                    </div>
                                </div>
                            );
                        })}
                        {shifts.length === 0 && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <p>Brak zmian.</p>
                                <button onClick={() => setIsManageModalOpen(true)} className="mt-2 text-blue-600 underline text-sm">Utwórz pierwszą zmianę</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- FLOATING DROP ZONE (WYPISZ) --- */}
            <div 
                onDragOver={(e) => handleDragOver(e, 'floating-unassigned')}
                onDrop={() => handleDrop(null)}
                className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 transform ${
                    draggedEmpId !== null ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'
                }`}
            >
                <div className={`
                    flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl border backdrop-blur-md transition-all duration-200 cursor-pointer ring-4 ring-black/5
                    ${isDraggingOver === 'floating-unassigned' 
                        ? 'bg-red-50 border-red-400 text-red-700 scale-110 shadow-red-200' 
                        : 'bg-slate-800/95 border-slate-700 text-white hover:bg-black'}
                `}>
                    <div className={`p-1.5 rounded-full ${isDraggingOver === 'floating-unassigned' ? 'bg-red-200' : 'bg-slate-600'}`}>
                        <ArrowDownToLine size={20}/>
                    </div>
                    <div>
                        <span className="font-bold text-sm block">Wypisz ze zmiany</span>
                        <span className="text-[10px] opacity-70 block">Upuść tutaj, aby przenieść do nieprzypisanych</span>
                    </div>
                </div>
            </div>

            {/* MODAL ZARZĄDZANIA */}
            {isManageModalOpen && (
                <ShiftManagementModal 
                    isOpen={isManageModalOpen} 
                    onClose={() => setIsManageModalOpen(false)} 
                    shifts={shifts}
                    refreshData={fetchData}
                />
            )}
        </div>
    );
}

// --- KOMPONENT KAFELKA ---
const EmployeeCard = ({ employee, onDragStart, mini = false }: { employee: Employee, onDragStart: () => void, mini?: boolean }) => (
    <div 
        draggable 
        onDragStart={onDragStart} 
        className={`group bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 relative select-none ${mini ? 'p-2' : 'p-3'}`}
    >
        {!mini && <div className="absolute right-2 top-3 text-slate-300 group-hover:text-blue-400"><GripVertical size={14} /></div>}
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200 shrink-0">
                {employee.firstName[0]}{employee.lastName[0]}
            </div>
            <div className="min-w-0">
                <h4 className="font-bold text-slate-800 text-xs leading-tight truncate">{employee.firstName} {employee.lastName}</h4>
                <p className="text-[10px] text-slate-500 truncate">{employee.position}</p>
            </div>
        </div>
        {!mini && (
            <div className="mt-2 pt-2 border-t border-slate-50 flex justify-between items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Users size={10}/> {employee.department?.name || "Brak Działu"}
                </span>
            </div>
        )}
    </div>
);

// --- MODAL ZARZĄDZANIA ZMIANAMI ---
function ShiftManagementModal({ isOpen, onClose, shifts, refreshData }: { isOpen: boolean, onClose: () => void, shifts: Shift[], refreshData: () => void }) {
    const [isEditingId, setIsEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ name: '', startTime: '', endTime: '' });

    const resetForm = () => { setIsEditingId(null); setFormData({ name: '', startTime: '', endTime: '' }); };
    const startEdit = (shift: Shift) => { setIsEditingId(shift.id); setFormData({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime }); };

    const handleSave = async () => {
        if(!formData.name || !formData.startTime || !formData.endTime) return toast.error("Wypełnij wszystkie pola");
        try {
            if(isEditingId) {
                await axios.put(`http://localhost:3000/api/shifts/${isEditingId}`, { ...formData, adminId: getAdminId() });
                toast.success("Zaktualizowano zmianę");
            } else {
                await axios.post('http://localhost:3000/api/shifts', { ...formData, adminId: getAdminId() });
                toast.success("Utworzono nową zmianę");
            }
            refreshData(); resetForm();
        } catch(e) { toast.error("Błąd zapisu"); }
    };

    const executeDelete = async (id: number) => {
        try {
            await axios.delete(`http://localhost:3000/api/shifts/${id}?adminId=${getAdminId()}`);
            toast.success("Usunięto zmianę"); refreshData();
        } catch(e) { toast.error("Nie można usunąć"); }
    };

    const confirmDelete = (shift: Shift) => {
        toast.custom((t) => (
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm animate-in fade-in zoom-in-95 pointer-events-auto">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-full"><Trash2 size={24} /></div>
                    <div><h3 className="text-lg font-bold text-slate-800">Usunąć zmianę?</h3><p className="text-sm text-slate-500 mt-1">Usuwasz <strong>{shift.name}</strong>.</p></div>
                </div>
                <div className="flex gap-3 mt-6 justify-end">
                    <button onClick={() => toast.dismiss(t)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg">Anuluj</button>
                    <button onClick={() => { toast.dismiss(t); executeDelete(shift.id); }} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-200">Usuń</button>
                </div>
            </div>
        ), { duration: Infinity, position: 'top-center' });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
                    <h3 className="font-bold flex items-center gap-2"><Settings size={18}/> Zarządzanie Zmianami</h3>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">{isEditingId ? <Pencil size={14}/> : <Plus size={14}/>} {isEditingId ? "Edytuj Zmianę" : "Nowa Zmiana"}</h4>
                        <div className="space-y-3">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nazwa</label><input type="text" className="w-full p-2 border rounded-lg text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Początek</label><input type="time" className="w-full p-2 border rounded-lg text-sm" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Koniec</label><input type="time" className="w-full p-2 border rounded-lg text-sm" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} /></div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                {isEditingId && <button onClick={resetForm} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border rounded-lg">Anuluj</button>}
                                <button onClick={handleSave} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2"><Save size={14}/> {isEditingId ? "Zapisz" : "Dodaj"}</button>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {shifts.map(s => (
                            <div key={s.id} className={`p-3 rounded-lg border flex justify-between items-center ${isEditingId === s.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                                <div><span className="font-bold text-slate-700 text-sm block">{s.name}</span><span className="text-xs text-slate-400 font-mono">{s.startTime} - {s.endTime}</span></div>
                                <div className="flex gap-1"><button onClick={() => startEdit(s)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={16}/></button><button onClick={() => confirmDelete(s)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}