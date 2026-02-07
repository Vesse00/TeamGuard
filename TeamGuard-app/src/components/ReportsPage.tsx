import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FileText, Calendar, AlertTriangle, CheckCircle, Download, Trash2, ChevronDown, ChevronUp, Filter, Play, CheckSquare, Square, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- KONFIGURACJA KATEGORII ---
const CATEGORY_LABELS: Record<string, string> = {
    'MANDATORY': 'BHP i Badania',
    'UDT': 'Urządzenia UDT',
    'SEP': 'Uprawnienia SEP',
    'DRIVING': 'Kierowcy',
    'OTHER': 'Inne'
};

const DETAILED_TYPES: Record<string, string[]> = {
    'UDT': ['Wózki jezdniowe (widłowe)', 'Podesty ruchome (zwyżki)', 'Żurawie (samojezdne, HDS, wieżowe)', 'Suwnice, wciągniki i wciągarki', 'Dźwigi (windy)', 'Układnice magazynowe', 'Urządzenia załadowcze/wyładowcze', 'Napełnianie/opróżnianie zbiorników (UNO)', 'Personel NDT (Badania nieniszczące)', 'Spawacz / Połączenia nierozłączne', 'Konserwator urządzeń UDT'],
    'SEP': ['G1 - Elektryczne (Eksploatacja)', 'G1 - Elektryczne (Dozór)', 'G2 - Cieplne (Eksploatacja)', 'G2 - Cieplne (Dozór)', 'G3 - Gazowe (Eksploatacja)', 'G3 - Gazowe (Dozór)'],
    'DRIVING': ['Prawo Jazdy Kat. B', 'Prawo Jazdy Kat. B+E', 'Prawo Jazdy Kat. C', 'Prawo Jazdy Kat. C+E', 'Prawo Jazdy Kat. D', 'Prawo Jazdy Kat. D+E', 'Prawo Jazdy Kat. T (Ciągnik)', 'Karta Kierowcy', 'Kwalifikacja Zawodowa (Kod 95)'],
    'MANDATORY': ['Badania Lekarskie', 'Szkolenie BHP']
};

interface Report {
  id: number;
  generatedAt: string;
  totalStaff: number;
  expiredCount: number;
  warningCount: number;
  detailsJson: string;
}

const pl = (str: string) => {
    if (!str) return '';
    const map: Record<string, string> = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
    };
    return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, match => map[match] || match);
};

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHistoryOpen, setHistoryOpen] = useState(true);
  const [generating, setGenerating] = useState(false);

  // --- FILTRY ---
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'WARNING'>('ALL');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isAllSpecifics, setIsAllSpecifics] = useState(false);
  const [selectedSpecifics, setSelectedSpecifics] = useState<string[]>([]);
  
  // --- ZAZNACZANIE (MASOWE USUWANIE) ---
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSpecificsDropdownOpen, setSpecificsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableSpecifics = selectedCategories.flatMap(cat => DETAILED_TYPES[cat] || []);

  useEffect(() => { fetchReports(); }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSpecificsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      setIsAllSpecifics(false);
      setSelectedSpecifics([]);
  }, [selectedCategories]);

  const fetchReports = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/reports');
      setReports(res.data);
    } catch (err) { toast.error("Nie udało się pobrać historii."); } 
    finally { setLoading(false); }
  };

  const handleGenerate = async () => {
      const userStr = localStorage.getItem('user');
      if (!userStr) return;
      const user = JSON.parse(userStr);
      setGenerating(true);
      
      let specificsToSend: string[] = [];
      if (!isAllSpecifics) {
          if (availableSpecifics.length > 0 && selectedSpecifics.length === 0) {
              toast.error("Wybierz typy uprawnień z listy lub zaznacz opcję 'Wszystkie'.");
              setGenerating(false);
              return;
          }
          specificsToSend = selectedSpecifics;
      }

      const payload = {
          userId: user.id,
          filters: {
              status: statusFilter,
              categories: selectedCategories,
              specificTypes: specificsToSend
          }
      };

      try {
          await axios.post('http://localhost:3000/api/reports/generate-now', payload);
          toast.success("Raport gotowy!");
          fetchReports(); 
      } catch (err) { toast.error("Błąd generowania."); } 
      finally { setGenerating(false); }
  };

  const toggleCategory = (cat: string) => {
      setSelectedCategories(prev => {
          const newCats = prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat];
          return newCats;
      });
  };

  const toggleSpecific = (spec: string) => {
      setSelectedSpecifics(prev => prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]);
  };

  // --- LOGIKA PDF ---
  const generatePDF = (report: Report) => {
    const doc = new jsPDF();
    let data = { items: [], statsPerType: {}, meta: { filterStatus: 'ALL', filterCategories: [], filterSpecifics: [] } };
    try { data = JSON.parse(report.detailsJson); } catch (e) { console.error("JSON Error", e); }
    const meta = data.meta as any || {};
    const items = (data.items || []) as any[];
    const stats = (data.statsPerType || {}) as Record<string, any>;
    const hasSpecificCharts = Object.keys(stats).length > 0;

    let mainTitle = "Raport BHP (Ogolny)";
    if (meta.filterStatus === 'EXPIRED') mainTitle = "Raport: ZALEGLOSCI";
    if (meta.filterStatus === 'WARNING') mainTitle = "Raport: WYGASAJACE";
    if (meta.filterStatus === 'ALL' && hasSpecificCharts) mainTitle = "Raport: INWENTARYZACJA UPRAWNIEN";
    
    doc.setFontSize(22); doc.setFont("helvetica", "bold"); 
    doc.text(`Raport #${report.id}`, 14, 20);
    doc.setFontSize(14); doc.setTextColor(100); 
    doc.text(mainTitle, 14, 28);
    doc.setFontSize(10); doc.setTextColor(0); 
    doc.text(`Data: ${new Date(report.generatedAt).toLocaleString('pl-PL')}`, 14, 36);
    doc.setDrawColor(200); doc.line(14, 40, 196, 40);

    let currentY = 50;

    if (hasSpecificCharts) {
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(pl("Statystyki wg Uprawnień:"), 14, currentY);
        currentY += 10;
        const keys = Object.keys(stats);
        let col = 0; 
        keys.forEach((key) => {
            if (currentY > 260) { doc.addPage(); currentY = 20; }
            const stat = stats[key];
            const xPos = col === 0 ? 14 : 110;
            const barWidth = 80;
            const barHeight = 8;
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`${pl(key)} (Razem: ${stat.total})`, xPos, currentY - 2);
            const validW = (stat.valid / stat.total) * barWidth;
            const warnW = (stat.warning / stat.total) * barWidth;
            const expW = (stat.expired / stat.total) * barWidth;
            doc.setFillColor(34, 197, 94); doc.rect(xPos, currentY, validW, barHeight, 'F');
            doc.setFillColor(249, 115, 22); doc.rect(xPos + validW, currentY, warnW, barHeight, 'F');
            doc.setFillColor(239, 68, 68); doc.rect(xPos + validW + warnW, currentY, expW, barHeight, 'F');
            doc.setFontSize(7); doc.setTextColor(100);
            let legend = `${stat.valid} OK`;
            if (stat.warning > 0) legend += `, ${stat.warning} Wygasa`;
            if (stat.expired > 0) legend += `, ${stat.expired} Zalegle`;
            doc.text(pl(legend), xPos, currentY + barHeight + 3);
            doc.setTextColor(0);
            if (col === 0) { col = 1; } else { col = 0; currentY += 20; }
        });
        if (col === 1) currentY += 20;
        currentY += 10;
    } else if (report.totalStaff > 0) {
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(pl("Status Ogólny Zespołu:"), 14, currentY);
        currentY += 10;
        const barW = 180;
        doc.setFillColor(34, 197, 94); doc.rect(14, currentY, barW, 15, 'F'); 
        if (report.expiredCount > 0) {
            doc.setFillColor(239, 68, 68); doc.rect(14, currentY, 20, 15, 'F');
            doc.text(`${report.expiredCount} Zaleglych`, 14, currentY + 22);
        }
        currentY += 30;
    }

    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
        if (!grouped[item.employeeName]) grouped[item.employeeName] = [];
        grouped[item.employeeName].push(item);
    });

    if (Object.keys(grouped).length > 0) {
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(pl("Szczegóły Pracowników:"), 14, currentY);
        currentY += 5;
        const tableBody: any[] = [];
        Object.keys(grouped).forEach(empName => {
            tableBody.push([{ content: pl(empName), colSpan: 3, styles: { fillColor: [240, 248, 255], fontStyle: 'bold', textColor: 0, cellPadding: 2 } }]);
            grouped[empName].forEach((item: any) => {
                let statusTxt = "OK";
                let textColor = [0, 128, 0];
                if (item.status === 'WARNING') { statusTxt = "WYGASA"; textColor = [255, 140, 0]; }
                if (item.status === 'EXPIRED') { statusTxt = "ZALEGLE"; textColor = [220, 20, 60]; }
                tableBody.push([`   - ${pl(item.complianceName)}`, item.expiryDate, { content: statusTxt, styles: { textColor: textColor, fontStyle: 'bold' } }]);
            });
        });
        autoTable(doc, {
            startY: currentY,
            head: [[pl('Uprawnienie'), pl('Ważne do'), 'Status']],
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 10 },
            columnStyles: { 0: { cellWidth: 100 } }
        });
    } else {
        doc.setFontSize(11); doc.setTextColor(150);
        doc.text(pl("Brak danych spełniających kryteria raportu."), 14, currentY + 10);
    }
    doc.save(`Raport_${report.id}.pdf`);
  };

  // --- LOGIKA USUWANIA MASOWEGO ---
  const toggleSelectReport = (id: number) => {
      setSelectedReportIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
      if (selectedReportIds.length === reports.length) {
          setSelectedReportIds([]);
      } else {
          setSelectedReportIds(reports.map(r => r.id));
      }
  };

  const executeBulkDelete = async (idsToDelete: number[]) => {
      setIsDeleting(true);
      try {
          await Promise.all(idsToDelete.map(id => axios.delete(`http://localhost:3000/api/reports/${id}`)));
          setReports(prev => prev.filter(r => !idsToDelete.includes(r.id)));
          setSelectedReportIds([]);
          toast.success(`Usunięto ${idsToDelete.length} raportów.`);
      } catch (error) {
          toast.error("Wystąpił błąd podczas usuwania.");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleDeleteSelected = () => {
      if (selectedReportIds.length === 0) return;
      toast.custom((t) => (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm">
          <div className="flex gap-4"><div className="p-3 bg-red-50 text-red-600 rounded-full"><Trash2 size={24} /></div><div><h3 className="font-bold">Usunąć wybrane?</h3><p className="text-sm text-slate-500">Usuwasz {selectedReportIds.length} raportów.</p></div></div>
          <div className="flex gap-3 mt-4 justify-end"><button onClick={() => toast.dismiss(t)} className="px-4 py-2 text-sm font-bold text-slate-600">Anuluj</button><button onClick={() => { toast.dismiss(t); executeBulkDelete(selectedReportIds); }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg">Usuń</button></div>
        </div>
      ), { duration: Infinity, position: 'top-center' });
  };

  const handleDeleteAllHistory = () => {
      if (reports.length === 0) return;
      const allIds = reports.map(r => r.id);
      toast.custom((t) => (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm">
          <div className="flex gap-4"><div className="p-3 bg-red-50 text-red-600 rounded-full"><Trash2 size={24} /></div><div><h3 className="font-bold">Wyczyścić historię?</h3><p className="text-sm text-slate-500">Usuwasz WSZYSTKIE ({allIds.length}) raporty. Operacja nieodwracalna.</p></div></div>
          <div className="flex gap-3 mt-4 justify-end"><button onClick={() => toast.dismiss(t)} className="px-4 py-2 text-sm font-bold text-slate-600">Anuluj</button><button onClick={() => { toast.dismiss(t); executeBulkDelete(allIds); }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg">Wyczyść</button></div>
        </div>
      ), { duration: Infinity, position: 'top-center' });
  };

  return (
    <div className="w-full pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">← Wróć</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Raporty</h1>
          <p className="text-slate-500 mt-1">Generuj zestawienia uprawnień i przeglądaj historię.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* --- KREATOR RAPORTU (LEWA KOLUMNA) --- */}
        <div className="xl:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Filter size={20}/></div>
                    <h2 className="text-lg font-bold text-slate-800">Kreator Raportu</h2>
                </div>

                {/* 1. STATUS */}
                <div className="mb-6">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-3">Zakres danych (Status)</label>
                    <div className="flex flex-wrap gap-3">
                        {[{ id: 'ALL', label: 'Wszystkie (Inwentaryzacja)', icon: FileText, color: 'blue' }, { id: 'WARNING', label: 'Tylko Wygasające', icon: AlertTriangle, color: 'orange' }, { id: 'EXPIRED', label: 'Tylko Zaległe', icon: AlertTriangle, color: 'red' }].map(opt => (
                            <button key={opt.id} onClick={() => setStatusFilter(opt.id as any)} className={`flex-1 min-w-[140px] p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-sm ${statusFilter === opt.id ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700` : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}`}>
                                <opt.icon size={16} /> {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. KATEGORIE */}
                <div className="mb-6">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-3">Kategorie (Zostaw puste = wszystkie)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.keys(CATEGORY_LABELS).map(catKey => {
                            const isSelected = selectedCategories.includes(catKey);
                            return (
                                <div key={catKey} className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-300'}`} onClick={() => toggleCategory(catKey)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>{isSelected && <CheckSquare size={14} className="text-white"/>}</div>
                                        <span className={`font-bold text-sm ${isSelected ? 'text-blue-800' : 'text-slate-600'}`}>{CATEGORY_LABELS[catKey]}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. SZCZEGÓŁY */}
                {availableSpecifics.length > 0 && (
                    <div className="mb-8 animate-in slide-in-from-top-2 relative" ref={dropdownRef}>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-3">Szczegółowe typy uprawnień</label>
                        <div className="flex gap-3">
                            <button onClick={() => setIsAllSpecifics(!isAllSpecifics)} className={`px-5 py-3.5 rounded-xl border font-bold transition-all flex items-center gap-2 ${isAllSpecifics ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                {isAllSpecifics ? <CheckCircle size={18} /> : <div className="w-[18px]"/>} Wszystkie
                            </button>
                            <div className="relative flex-1">
                                <button onClick={() => !isAllSpecifics && setSpecificsDropdownOpen(!isSpecificsDropdownOpen)} disabled={isAllSpecifics} className={`w-full h-full px-4 border rounded-xl flex items-center justify-between transition-all text-left ${isAllSpecifics ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'}`}>
                                    <span className="font-medium truncate pr-2">{isAllSpecifics ? "Wszystkie typy z wybranych kategorii" : (selectedSpecifics.length === 0 ? "Wybierz typy z listy..." : `Wybrano: ${selectedSpecifics.length}`)}</span>
                                    {isSpecificsDropdownOpen ? <ChevronUp size={20} className={isAllSpecifics ? "text-slate-300" : "text-slate-500"}/> : <ChevronDown size={20} className={isAllSpecifics ? "text-slate-300" : "text-slate-500"}/>}
                                </button>
                                {isSpecificsDropdownOpen && !isAllSpecifics && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto p-2 animate-in zoom-in-95 duration-100">
                                        {availableSpecifics.map(spec => {
                                            const isSelected = selectedSpecifics.includes(spec);
                                            return (
                                                <div key={spec} onClick={() => toggleSpecific(spec)} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2.5 rounded-lg transition-colors group">
                                                    {isSelected ? <CheckSquare size={18} className="text-blue-600 shrink-0"/> : <Square size={18} className="text-slate-300 group-hover:text-slate-500 shrink-0"/>}
                                                    <span className={`text-sm ${isSelected ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{spec}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        {!isAllSpecifics && selectedSpecifics.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in">
                                {selectedSpecifics.map(spec => (
                                    <span key={spec} className="inline-flex items-center gap-1 bg-white text-slate-700 px-2 py-1 rounded-md text-xs font-bold border border-slate-200 shadow-sm">{spec} <button onClick={() => toggleSpecific(spec)} className="hover:text-red-500 transition-colors ml-1"><X size={12}/></button></span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <button onClick={handleGenerate} disabled={generating} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 flex items-center justify-center gap-3">
                    {generating ? 'Generowanie...' : <><Play size={24} className="fill-white"/> Stwórz Raport PDF</>}
                </button>
            </div>
        </div>

        {/* --- HISTORIA (PRAWA KOLUMNA) --- */}
        <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex flex-col gap-3">
                    <button onClick={() => setHistoryOpen(!isHistoryOpen)} className="w-full flex items-center justify-between hover:text-blue-600 transition-colors">
                        <div className="flex items-center gap-2">
                            <FileText size={18} className="text-slate-500"/>
                            <h2 className="font-bold text-slate-700">Historia Raportów</h2>
                            <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">{reports.length}</span>
                        </div>
                        {isHistoryOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                    </button>
                    
                    {isHistoryOpen && reports.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 animate-in slide-in-from-top-2">
                             <button onClick={toggleSelectAll} className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1">
                                {selectedReportIds.length === reports.length ? <CheckSquare size={14}/> : <Square size={14}/>}
                                {selectedReportIds.length === reports.length ? 'Odznacz' : 'Zaznacz wszystko'}
                             </button>

                             <div className="flex gap-2">
                                {selectedReportIds.length > 0 && (
                                    <button onClick={handleDeleteSelected} disabled={isDeleting} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors shadow-sm">
                                        Usuń wybrane ({selectedReportIds.length})
                                    </button>
                                )}
                                {selectedReportIds.length === 0 && (
                                     <button onClick={handleDeleteAllHistory} disabled={isDeleting} className="text-xs font-bold text-slate-400 hover:text-red-600 px-2 py-1 rounded transition-colors">
                                        Usuń wszystkie
                                    </button>
                                )}
                             </div>
                        </div>
                    )}
                </div>

                {/* LISTA SKRÓCONA DO 450px */}
                {isHistoryOpen && (
                    <div className="max-h-[450px] overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
                        {reports.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm">Brak historii.</div> : 
                            reports.map(report => {
                                const isSelected = selectedReportIds.includes(report.id);
                                return (
                                <div key={report.id} className={`p-3 rounded-xl border transition-all group relative ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'}`}>
                                    <div className="absolute top-3 right-3 z-10" onClick={(e) => { e.stopPropagation(); toggleSelectReport(report.id); }}>
                                        {isSelected 
                                            ? <div className="text-blue-600 cursor-pointer"><CheckSquare size={20} /></div>
                                            : <div className="text-slate-200 group-hover:text-slate-400 cursor-pointer"><Square size={20} /></div>
                                        }
                                    </div>
                                    <div className="flex justify-between items-start mb-2 pr-8">
                                        <div onClick={() => !isSelected && toggleSelectReport(report.id)} className="cursor-pointer">
                                            <p className="font-bold text-slate-700 text-sm">Raport #{report.id}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{new Date(report.generatedAt).toLocaleDateString()} <span className="text-slate-300">|</span> {new Date(report.generatedAt).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</p>
                                        </div>
                                        <div className={`mt-1 w-2 h-2 rounded-full ${report.expiredCount > 0 ? 'bg-red-500' : report.warningCount > 0 ? 'bg-orange-400' : 'bg-green-500'}`}></div>
                                    </div>
                                    <div className="flex gap-2 justify-end opacity-60 group-hover:opacity-100 transition-opacity mt-2">
                                        <button onClick={() => generatePDF(report)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded flex items-center gap-1 text-xs font-bold">
                                            <Download size={14}/> PDF
                                        </button>
                                    </div>
                                </div>
                            )})
                        }
                    </div>
                )}
                
                {!isHistoryOpen && reports.length > 0 && <div className="text-center p-4 text-xs text-slate-400">Rozwiń historię, aby zarządzać {reports.length} raportami.</div>}
            </div>
        </div>

      </div>
    </div>
  );
}