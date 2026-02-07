import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('Hasła muszą być identyczne');
    if (password.length < 8) return toast.error('Hasło min. 8 znaków');

    setLoading(true);
    try {
        await axios.post('http://localhost:3000/api/auth/set-password', { token, password });
        toast.success('Hasło ustawione! Zaloguj się.');
        navigate('/login');
    } catch (e) { toast.error('Link jest nieważny lub wygasł.'); } 
    finally { setLoading(false); }
  };

  if (!token) return <div className="p-10 text-center text-red-500 font-bold">Brak tokenu w linku.</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Witaj w TeamGuard</h2>
        <p className="text-slate-500 mb-6">Ustaw hasło, aby aktywować swoje konto.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
                <input type={show ? "text" : "password"} placeholder="Nowe hasło" required className="w-full p-3 border rounded-xl" value={password} onChange={e=>setPassword(e.target.value)}/>
                <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-3 text-slate-400">{show?<EyeOff size={20}/>:<Eye size={20}/>}</button>
            </div>
            <input type="password" placeholder="Powtórz hasło" required className="w-full p-3 border rounded-xl" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
            <button disabled={loading} className="w-full bg-blue-600 text-white font-bold p-3 rounded-xl hover:bg-blue-700">
                {loading ? 'Zapisywanie...' : 'Aktywuj Konto'}
            </button>
        </form>
      </div>
    </div>
  );
}