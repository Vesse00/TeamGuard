import { useState, useEffect } from 'react'; // Zmiana
import { Link } from 'react-router-dom';
import axios from 'axios'; // Zmiana
import { User, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { AddEmployeeModal } from './AddEmployeeModal'; // <--- Import nowego okna

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
  compliance: Compliance[];
}

// ZMIANA: Usuwamy props { employees }, bo teraz ten komponent sam sobie pobierze dane
export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false); // Stan otwarcia okna

  // Funkcja pobierająca dane (użyjemy jej przy starcie i po dodaniu pracownika)
  const fetchEmployees = () => {
    axios.get('http://localhost:3000/api/employees')
      .then(res => setEmployees(res.data))
      .catch(err => console.error(err));
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

  return (
    <div className="w-full">
      
      {/* OKNO MODALNE */}
      <AddEmployeeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchEmployees} // Po sukcesie odśwież listę!
      />

      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">← Wróć</Link>
          <h1 className="text-2xl font-bold text-slate-800">Lista Pracowników</h1>
        </div>
        
        {/* Przycisk otwiera okno */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <span>+</span> Dodaj Pracownika
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
        {employees.map((emp) => {
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
                    <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wide">{emp.position}</p>
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
    </div>
  );
}