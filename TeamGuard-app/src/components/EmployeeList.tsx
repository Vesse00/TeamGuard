import { useState, useEffect } from 'react'; // Zmiana
import { Link } from 'react-router-dom';
import axios from 'axios'; // Zmiana
import { User, AlertTriangle, CheckCircle, Clock, LayoutGrid, List as ListIcon, UserPlus, Trash2, X, CheckSquare, FileSpreadsheet, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AddEmployeeModal } from './AddEmployeeModal'; // <--- Import nowego okna
import { toast } from 'sonner';

interface Compliance {
  type: string;
  name: string;
  expiryDate: string;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  avatarInitials: string;
  isSystemAdmin: boolean;
  email: string;
  compliance: Compliance[];
  department: string;
}

// Typy sortowania
type SortKey = 'name' | 'position' | 'bhp' | 'medical' | null;

// ZMIANA: Usuwamy props { employees }, bo teraz ten komponent sam sobie pobierze dane
export function EmployeeList() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false); // Stan otwarcia okna

  // --- NOWE: Stan dla zaznaczonych pracowników ---
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Filtrowanie
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Wszystkie'); // Stan filtra
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' }); // Domyślnie sortuj po nazwisku A-Z

  // Funkcja pobierająca dane (użyjemy jej przy starcie i po dodaniu pracownika)
  const fetchEmployees = () => {
    axios.get('http://localhost:3000/api/employees')
      .then(res => {
        setEmployees(res.data)
        setSelectedIds([]);
      })
      .catch(err => console.error(err));
      
  };

  // Funkcja eksportu zaznaczonych
  const handleBulkExport = () => {
      // Budujemy URL z ID-kami: ?ids=1,2,3
      const idsParam = selectedIds.join(',');
      window.open(`http://localhost:3000/api/reports/export-excel?ids=${idsParam}`, '_blank');
      
      // Opcjonalnie: odznacz po pobraniu
      // setSelectedIds([]); 
  };

  // Pobierz dane przy wejściu na stronę
  useEffect(() => {
    fetchEmployees();
  }, []);

  const getStatus = (dateString: string) => {
    const today = new Date();
    const expiry = new Date(dateString);
    const warningThreshold = new Date();
    warningThreshold.setDate(today.getDate() + 30); 

    if (expiry < today) return 'EXPIRED';
    if (expiry < warningThreshold) return 'WARNING';
    return 'VALID';
  };

  // --- LOGIKA ZAZNACZANIA ---
  // Zaznacz / Odznacz wszystkich
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedIds(employees.map(emp => emp.id));
    } else {
        setSelectedIds([]);
    }
  };

  // Zaznacz pojedynczego
  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
        setSelectedIds([...selectedIds, id]);
    }
  };

  // --- 2. POPRAWIONA LOGIKA USUWANIA ---
  const handleBulkDelete = async () => {
    // Sprawdzamy, czy wśród zaznaczonych są administratorzy
    const adminsInSelection = employees.filter(e => selectedIds.includes(e.id) && e.isSystemAdmin);
    const validIdsToDelete = selectedIds.filter(id => !employees.find(e => e.id === id)?.isSystemAdmin);

    // Scenariusz A: Zaznaczono samych administratorów
    if (validIdsToDelete.length === 0 && adminsInSelection.length > 0) {
        toast.error('Nie można usunąć administratorów systemowych.');
        return;
    }

    // Scenariusz B: Zaznaczono mieszankę (Admini + Zwykli)
    let confirmMessage = `Czy na pewno chcesz usunąć ${selectedIds.length} pracowników?`;
    
    if (adminsInSelection.length > 0) {
        confirmMessage = `Wybrano ${selectedIds.length} osób, w tym ${adminsInSelection.length} Administratorów (oni zostaną pominięci). Czy chcesz usunąć pozostałych ${validIdsToDelete.length} pracowników?`;
    }

    if (!confirm(confirmMessage)) return;

    setIsBulkDeleting(true);
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;

    try {
        // Wysyłamy do usunięcia TYLKO validIdsToDelete (bez adminów)
        await Promise.all(validIdsToDelete.map(id => 
            axios.delete(`http://localhost:3000/api/employees/${id}?adminId=${currentUser?.id}`)
        ));
        
        toast.success(`Usunięto ${validIdsToDelete.length} pracowników`);
        fetchEmployees();
    } catch (error) {
        console.error(error);
        toast.error('Błąd usuwania');
    } finally {
        setIsBulkDeleting(false);
    }
  };

  // --- LOGIKA FILTROWANIA ---
  // 1. Pobieramy unikalne działy z listy pracowników
  const departments = ['Wszystkie', ...new Set(employees.map(e => e.department || 'Ogólny'))];

  // 2. Filtrujemy listę
  const filteredEmployees = employees.filter(emp => {
      if (selectedDepartment === 'Wszystkie') return true;
      return (emp.department || 'Ogólny') === selectedDepartment;
  });

  // --- LOGIKA SORTOWANIA ---
  const handleSort = (key: SortKey) => {
      let direction: 'asc' | 'desc' = 'asc';
      // Jeśli już sortujemy po tej kolumnie i jest ASC, to zmień na DESC
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  // Helper do wyświetlania ikonki sortowania
  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-300" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp size={14} className="text-blue-600" /> 
          : <ArrowDown size={14} className="text-blue-600" />;
  };

  // --- PRZETWARZANIE DANYCH (Filtrowanie + Sortowanie) ---
  const processEmployees = () => {
      // 1. Filtrowanie
      let result = employees.filter(emp => {
          if (selectedDepartment === 'Wszystkie') return true;
          return (emp.department || 'Ogólny') === selectedDepartment;
      });

      // 2. Sortowanie
      if (sortConfig.key) {
          result.sort((a, b) => {
              let valA: any = '';
              let valB: any = '';

              switch (sortConfig.key) {
                  case 'name': // Sortowanie po Nazwisku (potem Imieniu)
                      valA = a.lastName.toLowerCase() + a.firstName.toLowerCase();
                      valB = b.lastName.toLowerCase() + b.firstName.toLowerCase();
                      break;
                  case 'position': // Sortowanie po Dziale (potem Stanowisku)
                      valA = (a.department || '').toLowerCase() + a.position.toLowerCase();
                      valB = (b.department || '').toLowerCase() + b.position.toLowerCase();
                      break;
                  case 'bhp': // Sortowanie po dacie wygaśnięcia BHP
                      valA = a.compliance.find(c => c.name === 'Szkolenie BHP')?.expiryDate || '9999-12-31';
                      valB = b.compliance.find(c => c.name === 'Szkolenie BHP')?.expiryDate || '9999-12-31';
                      break;
                  case 'medical': // Sortowanie po dacie wygaśnięcia Badań
                      valA = a.compliance.find(c => c.name === 'Badania Lekarskie')?.expiryDate || '9999-12-31';
                      valB = b.compliance.find(c => c.name === 'Badania Lekarskie')?.expiryDate || '9999-12-31';
                      break;
              }

              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return result;
  };

  const filteredAndSortedEmployees = processEmployees();

  return (
    <div className="w-full">
      
      {/* OKNO MODALNE */}
      <AddEmployeeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchEmployees} // Po sukcesie odśwież listę!
      />

      {/* Nagłówek 
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">← Wróć</Link>
          <h1 className="text-2xl font-bold text-slate-800">Lista Pracowników</h1>
        </div>
        
        {/* Przycisk otwiera okno 
        
      </div>*/}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        {/* Nagłówek z powrotem */}
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">← Wróć</Link>
          <h1 className="text-2xl font-bold text-slate-800">Lista Pracowników</h1>
        </div>
    
        <div className="flex gap-3 items-center">
            {/* --- NOWE: FILTR DZIAŁÓW --- */}
            <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Filter size={16} />
                </div>
                <select 
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 hover:border-slate-300 transition-colors appearance-none cursor-pointer shadow-sm min-w-[160px]"
                >
                    {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>
                {/* Strzałka customowa */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
            </div>
            {/* Przełącznik Kafelki / Lista */}
            <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Widok kafelkowy"
               >
                   <LayoutGrid size={20} />
                </button>
            <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-100 text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Widok listy"
            >
                <ListIcon size={20} />
            </button>
        </div>
        {/* Guzik dodaj pracownika */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <span>+</span> Dodaj Pracownika
        </button>
        
      </div>
    </div>
    
    {/* --- PASEK MASOWYCH AKCJI (Pojawia się tylko gdy coś zaznaczono) --- */}
    {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-5 duration-300 border border-slate-700">
              <div className="flex items-center gap-3 font-medium">
                  <div className="bg-blue-600 text-xs font-bold px-2 py-0.5 rounded text-white">
                      {selectedIds.length}
                  </div>
                  <span>wybranych</span>
              </div>
              
              <div className="h-4 w-px bg-slate-700"></div>

              <button 
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 font-bold transition-colors hover:bg-white/5 px-3 py-1.5 rounded-lg"
              >
                  {isBulkDeleting ? 'Usuwanie...' : (
                      <>
                          <Trash2 size={18} />
                          Usuń zaznaczone
                      </>
                  )}
              </button>

              {/* NOWY PRZYCISK EKSPORTU */}
              <button 
                  onClick={handleBulkExport}
                  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-bold transition-colors hover:bg-white/5 px-3 py-1.5 rounded-lg ml-2"
              >
                  <FileSpreadsheet size={18} /> {/* Upewnij się, że masz import FileSpreadsheet */}
                  Eksportuj
              </button>

              <button 
                  onClick={() => setSelectedIds([])}
                  className="ml-2 p-1 text-slate-400 hover:text-white transition-colors"
                  title="Anuluj zaznaczenie"
              >
                  <X size={20} />
              </button>
          </div>
        )}

      {/* --- WIDOK KAFELKOWY (GRID) --- */}
      {viewMode === 'grid' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
        {filteredEmployees.map((emp) => {
            const alerts = emp.compliance.map(c => ({ ...c, status: getStatus(c.expiryDate) }))
                                         .filter(c => c.status !== 'VALID');
            const isUrgent = alerts.some(a => a.status === 'EXPIRED');
            const isAllOk = alerts.length === 0;

            return (
              <div key={emp.id} className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow relative ${isUrgent ? 'border-red-300 ring-1 ring-red-50' : 'border-slate-200'}`}>
                
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${isUrgent ? 'bg-red-500' : (isAllOk ? 'bg-green-500' : 'bg-amber-500')}`}></div>

                <div className="flex items-start justify-between mb-4 pl-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 leading-tight">{emp.firstName} {emp.lastName}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wide">{emp.position} / {emp.department}</p>
                  </div>
                  <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-200 shrink-0">
                    {emp.avatarInitials || <User size={16}/>}
                  </div>
                </div>

                <div className="pl-3 min-h-[28px] flex flex-wrap gap-2">
                    {isAllOk && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle size={12} /> Status OK
                        </span>
                    )}
                    {alerts.map((item, index) => (
                        <span key={index} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                            item.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                            {item.status === 'EXPIRED' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                            {item.name === 'Szkolenie BHP' ? 'BHP' : (item.name === 'Badania Lekarskie' ? 'Badania' : item.name)}: 
                            {item.status === 'EXPIRED' ? ' Wygasło!' : ' Wygasa'}
                        </span>
                    ))}
                </div>

                <div className="mt-5 pl-3">
                    <Link 
                      to={`/employees/${emp.id}`} 
                      className="block w-full py-1.5 rounded border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 hover:text-slate-800 transition-colors text-center decoration-0"
                    >
                        Szczegóły
                    </Link>
                </div>
                
              </div>
            );
        })}
      </div>
      )}

      {/* --- NOWY WIDOK LISTY (TABELA) --- */}
{viewMode === 'list' && (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {/* CHECKBOX "ZAZNACZ WSZYSTKICH" */}
                            <th className="p-5 w-10">
                                <input 
                                    type="checkbox" 
                                    onChange={handleSelectAll}
                                    checked={selectedIds.length === employees.length && employees.length > 0}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </th>
                            {/* 1. SORTOWANIE PO NAZWISKU */}
                            <th 
                                className="p-5 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center gap-2">
                                    Pracownik {getSortIcon('name')}
                                </div>
                            </th>
                            {/* 2. SORTOWANIE PO STANOWISKU/DZIALE */}
                            <th 
                                className="p-5 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleSort('position')}
                            >
                                <div className="flex items-center gap-2">
                                    Stanowisko / Dział {getSortIcon('position')}
                                </div>
                            </th>
                            {/* 3. SORTOWANIE PO BHP */}
                            <th 
                                className="p-5 text-center cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleSort('bhp')}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    BHP {getSortIcon('bhp')}
                                </div>
                            </th>
                            {/* 4. SORTOWANIE PO BADANIACH */}
                            <th 
                                className="p-5 text-center cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleSort('medical')}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    Badania {getSortIcon('medical')}
                                </div>
                            </th>
                        <th className="p-5 text-right">Akcja</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedEmployees.map((emp) => {
                         // Wyciągamy daty do tabeli
                         const bhp = emp.compliance.find(c => c.name === 'Szkolenie BHP');
                         const medical = emp.compliance.find(c => c.name === 'Badania Lekarskie');
                         const isSelected = selectedIds.includes(emp.id);
                         
                         // Helper kolorów (prosty)
                         const getStatusColor = (comp: Compliance | undefined) => {
                            if (!comp) return 'bg-slate-100 text-slate-400'; // Brak
                            // Logika dat
                            const days = Math.ceil((new Date(comp.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            if (days < 0) return 'bg-red-100 text-red-600';
                            if (days < 30) return 'bg-orange-100 text-orange-600';
                            return 'bg-green-100 text-green-600';
                         };

                         return (
                                <tr key={emp.id} className={`hover:bg-slate-50/80 transition-colors group ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                    {/* CHECKBOX WIERSZA */}
                                    <td className="p-5 text-center">
                                        <input 
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleSelectOne(emp.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                {emp.avatarInitials}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-xs text-slate-400">{emp.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600 font-medium">
                                        {emp.position} / {emp.department}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${getStatusColor(bhp)}`}>
                                            {bhp ? new Date(bhp.expiryDate).toLocaleDateString() : '-'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${getStatusColor(medical)}`}>
                                            {medical ? new Date(medical.expiryDate).toLocaleDateString() : '-'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Link 
                                            to={`/employees/${emp.id}`}
                                            className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            Szczegóły
                                        </Link>
                                    </td>
                                </tr>
                            );
                    })}
                </tbody>
            </table>
        </div>
    </div>
)}
      
    </div>
  );
}