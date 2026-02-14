import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Calendar, Clock, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface WorkLog {
    id: number;
    startedAt: string;
    endedAt: string | null;
}

interface Shift {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    departmentId: number | null;
}

interface User {
    id: number;
    firstName: string;
    lastName: string;
    departmentId: number | null;
    shiftId: number | null; // To jest "Shift Anchor" - zmiana startowa
}

// Helper: Numer tygodnia w roku
function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

export function UserSchedulePage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [user, setUser] = useState<User | null>(null);
    const [departmentShifts, setDepartmentShifts] = useState<Shift[]>([]);
    const [weekLogs, setWeekLogs] = useState<WorkLog[]>([]);
    const [loading, setLoading] = useState(true);

    const getUserId = () => {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u).id : null;
    };

    const fetchData = async () => {
        const userId = getUserId();
        if (!userId) return;

        try {
            // 1. Pobierz dane usera (żeby znać jego dział i zmianę startową)
            const userRes = await axios.get(`http://localhost:3000/api/employees/${userId}`);
            const userData = userRes.data;
            setUser(userData);

            if (userData.departmentId) {
                // 2. Pobierz WSZYSTKIE zmiany z jego działu (do rotacji)
                const shiftsRes = await axios.get('http://localhost:3000/api/shifts');
                // Filtrujemy tylko zmiany z tego działu i sortujemy po godzinie startu
                const deptShifts = shiftsRes.data
                    .filter((s: Shift) => s.departmentId === userData.departmentId)
                    .sort((a: Shift, b: Shift) => a.startTime.localeCompare(b.startTime));
                
                setDepartmentShifts(deptShifts);
            }

            // 3. Pobierz logi pracy (dla porównania Real vs Plan)
            const logsRes = await axios.get(`http://localhost:3000/api/work-logs?employeeId=${userId}`);
            setWeekLogs(logsRes.data);

            setLoading(false);
        } catch (error) {
            console.error(error);
            toast.error("Błąd pobierania grafiku");
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- LOGIKA ROTACJI ---
    const getShiftForWeek = (targetDate: Date) => {
        if (!user?.shiftId || departmentShifts.length === 0) return null;

        // Jeśli w dziale jest tylko 1 zmiana, nie ma rotacji
        if (departmentShifts.length === 1) return departmentShifts[0];

        // Znajdź indeks zmiany startowej pracownika
        const anchorIndex = departmentShifts.findIndex(s => s.id === user.shiftId);
        if (anchorIndex === -1) return null; // Coś nie tak z danymi

        // Oblicz numer tygodnia
        const weekNum = getWeekNumber(targetDate);

        // Algorytm rotacji: (StartowyIndeks + NumerTygodnia) % LiczbaZmian
        // Odejmujemy 1 od weekNum, żeby rotacja była płynna, lub zostawiamy jak jest.
        // Zakładamy rotację "do przodu" co tydzień.
        const rotatedIndex = (anchorIndex + weekNum) % departmentShifts.length;

        return departmentShifts[rotatedIndex];
    };

    // Generowanie dni tygodnia
    const getDaysOfWeek = () => {
        const startOfWeek = new Date(currentDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Ustaw na Poniedziałek
        startOfWeek.setDate(diff);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const changeWeek = (offset: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setCurrentDate(newDate);
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Ładowanie grafiku...</div>;

    const days = getDaysOfWeek();
    const currentShift = getShiftForWeek(currentDate); // Zmiana na CAŁY ten tydzień

    return (
        <div className="flex flex-col h-full max-w-5xl mx-auto">
            
            {/* HEADER */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-blue-600"/> Mój Grafik
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Tydzień {getWeekNumber(currentDate)} • {user?.departmentId ? "System Rotacyjny" : "System Stały"}
                    </p>
                </div>
                
                <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600"><ChevronLeft size={20}/></button>
                    <span className="text-sm font-bold text-slate-700 w-32 text-center">
                        {days[0].toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })} - {days[6].toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })}
                    </span>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600"><ChevronRight size={20}/></button>
                </div>
            </div>

            {/* INFO O AKTUALNEJ ZMIANIE */}
            {currentShift && (
                <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center">
                    <div>
                        <h3 className="text-blue-100 uppercase text-xs font-bold tracking-wider mb-1">Twoja zmiana w tym tygodniu</h3>
                        <div className="text-3xl font-bold flex items-center gap-3">
                            <Clock size={32} className="text-blue-200"/> 
                            {currentShift.startTime} - {currentShift.endTime}
                        </div>
                        <p className="text-blue-200 text-sm mt-1 opacity-80">
                            Rotacja automatyczna ({departmentShifts.length} zmiany w dziale)
                        </p>
                    </div>
                    <div className="text-right hidden sm:block">
                        <span className="block text-4xl font-black opacity-20">TYDZIEN {getWeekNumber(currentDate)}</span>
                    </div>
                </div>
            )}

            {/* LISTA DNI */}
            <div className="grid grid-cols-1 gap-4">
                {days.map((day) => {
                    const dateStr = day.toISOString().split('T')[0];
                    const log = weekLogs.find(l => l.startedAt.startsWith(dateStr));
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                    // Obliczanie statusu
                    let statusColor = "bg-white border-slate-200";
                    if (isToday) statusColor = "bg-blue-50 border-blue-200 ring-1 ring-blue-300";
                    
                    return (
                        <div key={dateStr} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${statusColor}`}>
                            
                            {/* 1. DATA */}
                            <div className="flex items-center gap-4 w-40">
                                <div className={`text-center w-12 py-1 rounded-lg ${isWeekend ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                    <span className="block text-xs font-bold uppercase">{day.toLocaleDateString('pl-PL', { weekday: 'short' })}</span>
                                    <span className="block text-lg font-bold">{day.getDate()}</span>
                                </div>
                                <div className="text-sm text-slate-500 font-medium">
                                    {day.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                                </div>
                            </div>

                            {/* 2. PLAN (GRAFIK) */}
                            <div className="flex-1 px-4 border-l border-slate-100">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Plan Grafiku</span>
                                    {isWeekend ? (
                                        <span className="text-slate-400 font-medium text-sm">Wolne</span>
                                    ) : (
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            {currentShift ? `${currentShift.startTime} - ${currentShift.endTime}` : "Brak grafiku"}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. REALNY CZAS PRACY (Z LOGÓW) */}
                            <div className="flex-1 px-4 border-l border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Rzeczywisty Czas</span>
                                {log ? (
                                    <div className="flex items-center gap-2">
                                        {/* Status spóźnienia (uproszczony) */}
                                        {currentShift && log.startedAt.split('T')[1].substring(0,5) > currentShift.startTime 
                                            ? <AlertCircle size={16} className="text-orange-500"/> 
                                            : <CheckCircle2 size={16} className="text-green-500"/>
                                        }
                                        <span className="text-slate-800 font-mono font-medium">
                                            {new Date(log.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            {' - '}
                                            {log.endedAt 
                                                ? new Date(log.endedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                                                : <span className="text-blue-600 animate-pulse">Praca...</span>
                                            }
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400 text-sm italic">-</span>
                                )}
                            </div>

                        </div>
                    );
                })}
            </div>
        </div>
    );
}