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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('Hasła nie są identyczne');
    if (password.length < 8) return toast.error('Hasło za krótkie (min 8 znaków).');

    setLoading(true);
    try {
        await axios.post('http://localhost:3000/api/auth/set-password', { token, password });
        toast.success('Hasło ustawione! Zaloguj się.');
        navigate('/login');
    } catch (error: any) {
        toast.error(error.response?.data?.error || 'Błąd ustawiania hasła.');
    } finally { setLoading(false); }
  };

  if (!token) return <div className="p-10 text-center text-red-500">Brak tokenu zaproszenia.</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock size={32}/></div>
            <h1 className="text-2xl font-bold text-slate-800">Aktywacja Konta</h1>
            <p className="text-slate-500 text-sm mt-1">Ustaw swoje hasło, aby uzyskać dostęp.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
                <input type={showPassword ? "text" : "password"} required placeholder="Nowe hasło" className="w-full p-3 border rounded-xl" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
            </div>
            <input type="password" required placeholder="Powtórz hasło" className="w-full p-3 border rounded-xl" value={confirm} onChange={e => setConfirm(e.target.value)} />
            <button disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">{loading ? 'Zapisywanie...' : 'Ustaw hasło'}</button>
        </form>
      </div>
    </div>
  );
}