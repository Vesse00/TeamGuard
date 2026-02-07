import { useState, useEffect } from 'react';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, X, ExternalLink, Download, CalendarDays, CalendarCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const CURRENT_YEAR = new Date().getFullYear();
// Generujemy zakres od 5 lat wstecz do 50 lat w przód
const YEARS = Array.from({ length: 55 }, (_, i) => CURRENT_YEAR - 5 + i);

export function CalendarPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    axios.get('http://localhost:3000/api/employees')
        .then(res => setEmployees(res.data))
        .catch(() => toast.error('Nie udało się pobrać danych do kalendarza'));
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay(); 
    return day === 0 ? 6 : day - 1; 
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getFirstDayOfMonth(year, month);

  const events: any[] = [];
  employees.forEach(emp => {
      emp.compliance?.forEach((c: any) => {
          const d = new Date(c.expiryDate);
          if (d.getMonth() === month && d.getFullYear() === year) {
              events.push({ 
                  day: d.getDate(), 
                  type: c.type, 
                  name: c.name, 
                  empName: `${emp.firstName} ${emp.lastName}`, 
                  date: c.expiryDate,
                  status: new Date(c.expiryDate) < new Date() ? 'EXPIRED' : 'VALID'
              });
          }
      });
  });

  const exportToGoogle = (evt: any) => {
      const dateStr = new Date(evt.date).toISOString().replace(/-|:|\.\d\d\d/g, "");
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Wygasa: ${evt.name}`)}&details=${encodeURIComponent(`Pracownik: ${evt.empName}`)}&dates=${dateStr}/${dateStr}`;
      window.open(url, '_blank');
  };

  const exportMonthToICS = () => {
      if (events.length === 0) {
          toast.info("Brak wydarzeń w tym miesiącu do eksportu.");
          return;
      }
      let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TeamGuard//BHP Calendar//PL\n";
      events.forEach(evt => {
          const dateStr = new Date(evt.date).toISOString().replace(/-|:|\.\d\d\d/g, "");
          icsContent += "BEGIN:VEVENT\n";
          icsContent += `SUMMARY:Wygasa: ${evt.name} (${evt.empName})\n`;
          icsContent += `DTSTART;VALUE=DATE:${dateStr.substring(0,8)}\n`;
          icsContent += `DTEND;VALUE=DATE:${dateStr.substring(0,8)}\n`;
          icsContent += `DESCRIPTION:Przypomnienie z TeamGuard. Pracownik: ${evt.empName}\n`;
          icsContent += "END:VEVENT\n";
      });
      icsContent += "END:VCALENDAR";
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `TeamGuard_Export_${month+1}_${year}.ics`;
      link.click();
      toast.success(`Pobrano ${events.length} wydarzeń do kalendarza.`);
  };

  const changeMonth = (delta: number) => setCurrentDate(new Date(year, month + delta, 1));
  const setMonth = (m: number) => setCurrentDate(new Date(year, m, 1));
  const setYear = (y: number) => setCurrentDate(new Date(y, month, 1));
  
  // --- NOWA FUNKCJA: Reset do dziś ---
  const resetToToday = () => setCurrentDate(new Date());

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">← Wróć do Dashboardu</Link>
            <div className="flex items-center gap-3 mt-1">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><CalendarDays size={24}/></div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Kalendarz BHP</h1>
                    <p className="text-slate-500 text-sm">Monitoruj terminy wygaśnięć uprawnień.</p>
                </div>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border shadow-sm">
            {/* GUZIK WRÓĆ DO DZIŚ */}
            <button 
                onClick={resetToToday} 
                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors mr-1"
                title="Wróć do obecnego miesiąca"
            >
                <CalendarCheck size={20} />
            </button>

            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 text-slate-500 rounded-lg transition-colors"><ChevronLeft size={20}/></button>
            
            <div className="flex gap-2">
                <select 
                    value={month} 
                    onChange={(e) => setMonth(Number(e.target.value))} 
                    className="bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-lg p-2 outline-none focus:border-blue-500 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>

                <select 
                    value={year} 
                    onChange={(e) => setYear(Number(e.target.value))} 
                    className="bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-lg p-2 outline-none focus:border-blue-500 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 text-slate-500 rounded-lg transition-colors"><ChevronRight size={20}/></button>

            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            <button 
                onClick={exportMonthToICS}
                className="flex items-center gap-2 bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-slate-700 transition-all shadow-md shadow-slate-200 active:scale-95"
            >
                <Download size={14}/> Eksportuj Widok
            </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
            {['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'].map(d => (
                <div key={d} className="py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
            ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[1fr] bg-slate-100 gap-px border-b border-slate-100">
            {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white min-h-[140px] p-2 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes-light.png')]"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = events.filter(e => e.day === day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

                return (
                    <div key={day} className={`bg-white min-h-[140px] p-3 transition-colors hover:bg-blue-50/30 relative group`}>
                        <div className={`flex justify-between items-center mb-2`}>
                            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-700'}`}>
                                {day}
                            </span>
                            {dayEvents.length > 0 && <span className="text-[10px] font-bold text-slate-400">{dayEvents.length} zdarzeń</span>}
                        </div>
                        <div className="space-y-1.5">
                            {dayEvents.map((evt, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setSelectedEvent(evt)} 
                                    className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium border transition-all shadow-sm hover:shadow-md truncate flex items-center gap-1.5
                                        ${evt.status === 'EXPIRED' 
                                            ? 'bg-red-50 text-red-700 border-red-100 hover:border-red-300' 
                                            : 'bg-orange-50 text-orange-700 border-orange-100 hover:border-orange-300'
                                        }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${evt.status === 'EXPIRED' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                                    <span className="truncate">{evt.empName.split(' ')[1]} • {evt.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
      </div>

      {selectedEvent && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
              <div className="bg-white p-0 rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden animate-in zoom-in-95">
                  <div className={`p-6 text-center ${selectedEvent.status === 'EXPIRED' ? 'bg-red-50' : 'bg-orange-50'}`}>
                      <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 p-1 bg-white/50 hover:bg-white rounded-full transition-colors text-slate-500"><X size={20}/></button>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border-4 border-white ${selectedEvent.status === 'EXPIRED' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                          <CalIcon size={24}/>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">{selectedEvent.name}</h3>
                      <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${selectedEvent.status === 'EXPIRED' ? 'text-red-600' : 'text-orange-600'}`}>
                          {selectedEvent.status === 'EXPIRED' ? 'Już po terminie' : 'Wygasa wkrótce'}
                      </p>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 uppercase">Pracownik</span>
                          <span className="text-sm font-bold text-slate-700">{selectedEvent.empName}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 uppercase">Data</span>
                          <span className="text-sm font-bold text-slate-700">{new Date(selectedEvent.date).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="pt-2 grid grid-cols-2 gap-3">
                          <button onClick={() => exportToGoogle(selectedEvent)} className="flex items-center justify-center gap-2 bg-white border border-slate-200 py-3 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all">
                              <ExternalLink size={16} className="text-blue-500"/> Google Cal
                          </button>
                          <button onClick={exportMonthToICS} className="flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl font-bold text-xs hover:bg-slate-700 transition-all shadow-lg shadow-slate-200">
                              <Download size={16}/> Outlook .ics
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}