import { HelpCircle, Mail, Phone, FileText, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { useState } from 'react';

// Przykładowe pytania i odpowiedzi
const faqs = [
  {
    question: "Jak dodać nowego pracownika?",
    answer: "Przejdź do zakładki 'Pracownicy' w menu bocznym, a następnie kliknij niebieski przycisk 'Dodaj' w prawym górnym rogu. Wypełnij formularz danymi osobowymi i wybierz dział."
  },
  {
    question: "Jak działa automatyczny onboarding?",
    answer: "Po dodaniu pracownika do konkretnego działu, system automatycznie przypisuje mu zadania zdefiniowane w szablonach tego działu (zakładka 'Działy'). Pracownik widzi je w swoim profilu."
  },
  {
    question: "Co oznaczają kolory przy uprawnieniach?",
    answer: "Zielony - uprawnienie jest ważne. Pomarańczowy - upływa termin ważności (mniej niż 30 dni). Czerwony - uprawnienie wygasło lub brakuje go."
  },
  {
    question: "Jak edytować dane pracownika?",
    answer: "Wejdź w profil pracownika (klikając 'Szczegóły' na liście), a następnie kliknij przycisk 'Edytuj' w prawym górnym rogu."
  },
  {
    question: "Czy mogę eksportować dane do Excela?",
    answer: "Tak. Na liście pracowników zaznacz osoby (checkboxem po lewej), a na dole ekranu pojawi się pasek z opcją 'Eksportuj'."
  }
];

export function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="max-w-5xl mx-auto p-6 animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <HelpCircle className="text-blue-600" size={32} />
          Centrum Pomocy
        </h1>
        <p className="text-slate-500 mt-2">Znajdź odpowiedzi na pytania i uzyskaj wsparcie techniczne.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEWA KOLUMNA: FAQ */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <MessageCircle className="text-indigo-500" size={20}/>
              <h2 className="text-lg font-bold text-slate-800">Często zadawane pytania (FAQ)</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {faqs.map((faq, index) => (
                <div key={index} className="group">
                  <button 
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors focus:outline-none"
                  >
                    <span className={`font-medium transition-colors ${openIndex === index ? 'text-blue-600' : 'text-slate-700'}`}>
                        {faq.question}
                    </span>
                    {openIndex === index ? <ChevronUp size={20} className="text-blue-500" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </button>
                  {openIndex === index && (
                    <div className="px-5 pb-5 pl-5 text-slate-600 text-sm leading-relaxed animate-in slide-in-from-top-1">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                 <FileText size={24} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Dokumentacja Techniczna</h2>
                <p className="text-slate-500 text-sm mb-3">
                    Szczegółowa instrukcja obsługi systemu TeamGuard, opis funkcji i procesów.
                </p>
                <button className="text-blue-600 font-bold text-sm hover:underline hover:text-blue-700">
                    Pobierz Instrukcję (PDF)
                </button>
             </div>
          </section>
        </div>

        {/* PRAWA KOLUMNA: KONTAKT */}
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden">
                {/* Ozdobne kółka w tle */}
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>

                <h2 className="text-xl font-bold mb-2 relative z-10">Potrzebujesz pomocy?</h2>
                <p className="text-blue-100 text-sm mb-6 relative z-10">Nasz zespół wsparcia jest dostępny od poniedziałku do piątku w godzinach 8:00 - 16:00.</p>
                
                <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                        <Mail className="shrink-0 text-blue-200" />
                        <div>
                            <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Email</p>
                            <a href="mailto:support@teamguard.pl" className="font-medium hover:text-white transition-colors">support@teamguard.pl</a>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                        <Phone className="shrink-0 text-blue-200" />
                        <div>
                             <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Telefon</p>
                            <a href="tel:+48123456789" className="font-medium hover:text-white transition-colors">+48 123 456 789</a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                <p className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-1">Wersja Systemu</p>
                <p className="text-slate-700 font-bold">TeamGuard v1.2.0 (Beta)</p>
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <a href="#" className="text-xs text-slate-400 hover:text-slate-600">Polityka Prywatności</a>
                    <span className="mx-2 text-slate-300">•</span>
                    <a href="#" className="text-xs text-slate-400 hover:text-slate-600">Regulamin</a>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}