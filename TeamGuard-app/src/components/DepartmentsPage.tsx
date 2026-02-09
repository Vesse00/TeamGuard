import { useState, useEffect } from 'react';
import axios from 'axios';
import { Building, Users, Trash2, Plus, ListChecks, CheckCircle, ArrowRight, Layers } from 'lucide-react';
import { toast } from 'sonner';

// --- TYPY DANYCH ---
interface OnboardingTask {
    id: number;
    task: string;
}

interface Department {
    id: number;
    name: string;
    _count: { employees: number };
    onboardingTemplates: OnboardingTask[];
}

export function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Stany formularzy
    const [newDeptName, setNewDeptName] = useState('');
    const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
    const [newTaskName, setNewTaskName] = useState('');

    // --- POBIERANIE DANYCH ---
    const fetchDepartments = async () => {
        try {
            const res = await axios.get('http://localhost:3000/api/departments');
            setDepartments(res.data);
            setLoading(false);
        } catch (error) {
            toast.error('Nie udało się pobrać listy działów.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    // --- 1. DODAWANIE DZIAŁU ---
    const handleAddDept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeptName.trim()) return;

        try {
            await axios.post('http://localhost:3000/api/departments', { name: newDeptName });
            toast.success('Dodano nowy dział!');
            setNewDeptName('');
            fetchDepartments();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Błąd dodawania działu.');
        }
    };

    // --- 2. USUWANIE DZIAŁU ---
    const handleDeleteDept = async (id: number, empCount: number) => {
        if (empCount > 0) {
            toast.error('Nie możesz usunąć działu, w którym są pracownicy!');
            return;
        }
        if (!confirm('Czy na pewno usunąć ten dział? Usunie to również szablony zadań.')) return;

        try {
            await axios.delete(`http://localhost:3000/api/departments/${id}`);
            toast.success('Dział usunięty.');
            if (selectedDeptId === id) setSelectedDeptId(null);
            fetchDepartments();
        } catch (error) {
            toast.error('Błąd usuwania działu.');
        }
    };

    // --- 3. DODAWANIE ZADANIA (TEMPLATE) ---
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDeptId || !newTaskName.trim()) return;

        try {
            await axios.post(`http://localhost:3000/api/departments/${selectedDeptId}/templates`, {
                task: newTaskName
            });
            toast.success('Zadanie dodane do szablonu.');
            setNewTaskName('');
            fetchDepartments(); 
        } catch (error) {
            toast.error('Błąd dodawania zadania.');
        }
    };

    // --- 4. USUWANIE ZADANIA ---
    const handleDeleteTask = async (taskId: number) => {
        try {
            await axios.delete(`http://localhost:3000/api/templates/${taskId}`);
            toast.success('Zadanie usunięte.');
            fetchDepartments();
        } catch (error) {
            toast.error('Błąd usuwania zadania.');
        }
    };

    // Wybrany dział (obiekt)
    const activeDept = departments.find(d => d.id === selectedDeptId);

    if (loading) return <div className="p-10 text-center text-slate-400">Ładowanie...</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 animate-in fade-in">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <Building className="text-blue-600" size={32} />
                    Struktura Organizacyjna
                </h1>
                <p className="text-slate-500 mt-2">Twórz działy i przypisuj im automatyczne zadania onboardingowe.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEWA KOLUMNA: LISTA DZIAŁÓW */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Formularz dodawania */}
                    <form onSubmit={handleAddDept} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nowy Dział</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Np. Marketing" 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                value={newDeptName}
                                onChange={e => setNewDeptName(e.target.value)}
                            />
                            <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors">
                                <Plus size={20} />
                            </button>
                        </div>
                    </form>

                    {/* Lista działów */}
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                        {departments.map(dept => (
                            <div 
                                key={dept.id} 
                                onClick={() => setSelectedDeptId(dept.id)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md flex justify-between items-center group
                                    ${selectedDeptId === dept.id 
                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                                        : 'bg-white border-slate-200 hover:border-blue-300'}`}
                            >
                                <div>
                                    <h3 className={`font-bold ${selectedDeptId === dept.id ? 'text-blue-800' : 'text-slate-700'}`}>
                                        {dept.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                        <Users size={12} /> {dept._count?.employees || 0} Pracowników
                                    </div>
                                </div>
                                
                                {selectedDeptId === dept.id && (
                                    <div className="flex items-center gap-2">
                                         {/* Przycisk usuwania (tylko jeśli 0 pracowników) */}
                                        {(dept._count?.employees || 0) === 0 && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteDept(dept.id, dept._count?.employees || 0); }}
                                                className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                                                title="Usuń dział"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <ArrowRight size={16} className="text-blue-500" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* PRAWA KOLUMNA: SZCZEGÓŁY I ONBOARDING */}
                <div className="lg:col-span-2">
                    {activeDept ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full min-h-[400px]">
                            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <ListChecks className="text-indigo-600"/>
                                        Onboarding: {activeDept.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Te zadania zostaną automatycznie przypisane każdemu nowemu pracownikowi w tym dziale.
                                    </p>
                                </div>
                                <div className="text-3xl font-bold text-slate-200">
                                    {activeDept.onboardingTemplates.length}
                                </div>
                            </div>

                            <div className="p-6">
                                {/* Formularz dodawania zadania */}
                                <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
                                    <input 
                                        type="text" 
                                        placeholder="Wpisz treść zadania (np. 'Odbierz laptopa')..." 
                                        className="flex-1 p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 bg-slate-50"
                                        value={newTaskName}
                                        onChange={e => setNewTaskName(e.target.value)}
                                    />
                                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 font-bold rounded-xl transition-colors">
                                        Dodaj
                                    </button>
                                </form>

                                {/* Lista Zadań */}
                                {activeDept.onboardingTemplates.length > 0 ? (
                                    <ul className="space-y-3">
                                        {activeDept.onboardingTemplates.map((task, index) => (
                                            <li key={task.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg group hover:border-slate-200 transition-colors shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-slate-700 font-medium">{task.task}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    className="text-slate-300 hover:text-red-500 p-2 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <CheckCircle className="mx-auto text-slate-300 mb-2" size={32} />
                                        <p className="text-slate-500 font-medium">Brak zdefiniowanych zadań.</p>
                                        <p className="text-xs text-slate-400">Dodaj pierwsze zadanie powyżej.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-12 min-h-[400px]">
                            <Layers size={48} className="mb-4 opacity-50" />
                            <p className="text-lg font-medium">Wybierz dział z listy po lewej</p>
                            <p className="text-sm">aby zarządzać jego ustawieniami i onboardingiem.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}