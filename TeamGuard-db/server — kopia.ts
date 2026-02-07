import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';


const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET;

// --- GET: Wszyscy pracownicy ---
app.get('/api/employees', async (req, res) => {
  const employees = await prisma.employee.findMany({
    include: { compliance: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(employees);
});

// --- GET: Szczegóły pracownika ---
app.get('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const employee = await prisma.employee.findUnique({
    where: { id: Number(id) },
    include: { compliance: true }
  });
  res.json(employee);
});

// --- POST: Dodaj pracownika ---
app.post('/api/employees', async (req, res) => {
  const { firstName, lastName, position, email, hiredAt, bhpDate, medicalDate } = req.body;
  
  // Funkcja pomocnicza do inicjałów
  const getInitials = (f: string, l: string) => `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();

  // Helper do obliczania dat (obsługuje "0.5" roku)
  const calculateExpiry = (start: Date, years: string) => {
     const date = new Date(start);
     if (years === '0.5') date.setMonth(date.getMonth() + 6);
     else date.setFullYear(date.getFullYear() + parseInt(years));
     return date;
  };

  try {
    const newEmployee = await prisma.employee.create({
      data: {
        firstName, lastName, position, email,
        hiredAt: new Date(hiredAt),
        avatarInitials: getInitials(firstName, lastName),
        compliance: {
          create: [
             // Automatyczne tworzenie BHP (Domyślnie 6 miesięcy - Wstępne)
             { 
               name: 'Szkolenie BHP', 
               type: 'MANDATORY', 
               status: 'VALID',
               issueDate: new Date(hiredAt),
               duration: '0.5',
               expiryDate: calculateExpiry(new Date(hiredAt), '0.5')
             },
             // Automatyczne tworzenie Badań (Domyślnie 2 lata)
             { 
               name: 'Badania Lekarskie', 
               type: 'MANDATORY', 
               status: 'VALID',
               issueDate: new Date(hiredAt),
               duration: '2',
               expiryDate: calculateExpiry(new Date(hiredAt), '2')
             }
          ]
        }
      },
      include: { compliance: true } // Zwróć od razu z uprawnieniami
    });
    res.json(newEmployee);
  } catch (error) {
    res.status(500).json({ error: 'Błąd tworzenia pracownika' });
  }
});

// --- PUT: Edycja danych pracownika ---
app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, position, email, hiredAt } = req.body;
  try {
    const updated = await prisma.employee.update({
      where: { id: Number(id) },
      data: { firstName, lastName, position, email, hiredAt: new Date(hiredAt) }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Błąd aktualizacji' });
  }
});

// --- DELETE: Usuń pracownika ---
app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.employee.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Błąd usuwania' });
  }
});

// --- POST: Dodaj uprawnienie (Nowe pola!) ---
app.post('/api/compliance', async (req, res) => {
  const { name, expiryDate, issueDate, duration, status, employeeId, type } = req.body;
  try {
    const newCompliance = await prisma.complianceEvent.create({
      data: {
        name,
        status: status || 'VALID',
        type: type || 'OTHER',
        employeeId: Number(employeeId),
        // Kluczowe dla odnawiania:
        expiryDate: new Date(expiryDate),
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        duration: duration ? String(duration) : "1"
      }
    });
    res.json(newCompliance);
  } catch (error) {
    res.status(500).json({ error: 'Błąd dodawania uprawnienia' });
  }
});

// --- PUT: Edytuj/Odnów uprawnienie ---
app.put('/api/compliance/:id', async (req, res) => {
  const { id } = req.params;
  // Przyjmujemy issueDate i duration przy odnawianiu
  const { expiryDate, issueDate, duration } = req.body;
  try {
    const updated = await prisma.complianceEvent.update({
      where: { id: Number(id) },
      data: {
        expiryDate: new Date(expiryDate),
        ...(issueDate && { issueDate: new Date(issueDate) }),
        ...(duration && { duration: String(duration) })
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Błąd edycji uprawnienia' });
  }
});

// --- ZAKTUALIZOWANY DELETE: Blokada usuwania Admina ---
app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Sprawdź czy to admin
    const emp = await prisma.employee.findUnique({ where: { id: Number(id) } });
    
    if (emp?.isSystemAdmin) {
        return res.status(403).json({ error: 'Nie można usunąć konta Administratora Głównego.' });
    }

    // 2. Jeśli nie admin, usuń
    await prisma.employee.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Błąd usuwania' });
  }
});

// --- DELETE: Usuń UPRAWNIENIE (Tego brakowało!) ---
app.delete('/api/compliance/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.complianceEvent.delete({
      where: { id: Number(id) }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Błąd usuwania uprawnienia:", error);
    res.status(500).json({ error: 'Nie udało się usunąć uprawnienia' });
  }
});

if (!SECRET_KEY) {
  console.error("BŁĄD KRYTYCZNY: Brak zmiennej JWT_SECRET w pliku .env!");
  process.exit(1); // Wyłącz serwer, bo nie jest bezpieczny
}

// --- ENDPOINT: REJESTRACJA ---
app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // 1. Walidacja EMAIL (Musi mieć @ i kropkę)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Nieprawidłowy format adresu email.' });
  }

  // 2. Walidacja HASŁA (Min 8 znaków, min 1 znak specjalny)
  // Wyjaśnienie Regexa: co najmniej 8 znaków, dowolne znaki
  // oraz sprawdzenie czy zawiera znak specjalny (!@#$%^&*...)
  const passwordRegex = /[!@#$%^&*(),.?":{}|<>]/; 
  if (password.length < 8 || !passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Hasło musi mieć min. 8 znaków i znak specjalny.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik o tym emailu już istnieje' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Prisma automatycznie escapuje dane (chroni przed SQL Injection)
    const user = await prisma.user.create({
      data: { firstName, lastName, email, password: hashedPassword }
    });

    res.json({ message: 'Użytkownik utworzony pomyślnie', userId: user.id });
  } catch (error) {
    console.error("Błąd rejestracji:", error);
    res.status(500).json({ error: 'Błąd rejestracji' });
  }
});

// --- ENDPOINT: LOGOWANIE ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Generujemy token używając klucza z .env (SECRET_KEY jest teraz bezpieczny)
    // TypeScript wie, że SECRET_KEY istnieje, bo sprawdziliśmy to na górze
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` },
      SECRET_KEY as string, 
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Błąd logowania' });
  }
});

// --- ONBOARDING ADMINA (Z LOGOWANIEM BŁĘDÓW) ---
app.post('/api/employees/onboarding', async (req, res) => {
  try {
    const { userId, firstName, lastName, email, position, hiredAt, bhpDate, medicalDate, bhpDuration, medicalDuration, skipped } = req.body;
    
    console.log("Onboarding request:", { userId, email, skipped }); // LOGOWANIE DANYCH WEJŚCIOWYCH

    if (!userId) {
        return res.status(400).json({ error: 'Brak ID użytkownika (userId). Zaloguj się ponownie.' });
    }

    const getInitials = (f: string, l: string) => `${f?.charAt(0) || ''}${l?.charAt(0) || ''}`.toUpperCase();
    
    // Data wczorajsza dla pominiętych/wygasłych
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Bezpieczna funkcja daty
    const safeDate = (dateStr: string | undefined) => {
        if (!dateStr) return yesterday;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? yesterday : d;
    };

    const calculateExpiry = (startStr: string, years: string) => {
        if (!startStr) return yesterday;
        const date = new Date(startStr);
        if (isNaN(date.getTime())) return yesterday; // Zabezpieczenie przed złą datą

        if (years === '0.5') date.setMonth(date.getMonth() + 6);
        else date.setFullYear(date.getFullYear() + parseInt(years || '0'));
        
        return date;
    };

    // Obliczamy daty
    const issueBhp = (skipped || !bhpDate) ? yesterday : safeDate(bhpDate);
    const expiryBhp = skipped ? yesterday : calculateExpiry(bhpDate, bhpDuration || '5');
    
    const issueMed = (skipped || !medicalDate) ? yesterday : safeDate(medicalDate);
    const expiryMed = skipped ? yesterday : calculateExpiry(medicalDate, medicalDuration || '2');

    const newEmployee = await prisma.employee.create({
      data: {
        firstName: firstName || '',
        lastName: lastName || '',
        email: email,
        position: position || 'Administrator',
        hiredAt: hiredAt ? safeDate(hiredAt) : new Date(),
        avatarInitials: getInitials(firstName, lastName),
        isSystemAdmin: true,
        userId: Number(userId), // Upewniamy się, że to liczba
        compliance: {
          create: [
             { 
               name: 'Szkolenie BHP', type: 'MANDATORY', 
               status: skipped ? 'EXPIRED' : 'VALID',
               issueDate: issueBhp, 
               expiryDate: expiryBhp,
               duration: bhpDuration || '5' 
             },
             { 
               name: 'Badania Lekarskie', type: 'MANDATORY', 
               status: skipped ? 'EXPIRED' : 'VALID',
               issueDate: issueMed,
               expiryDate: expiryMed,
               duration: medicalDuration || '2'
             }
          ]
        }
      }
    });

    res.json(newEmployee);

  } catch (error: any) {
    // TO POKAŻE PRAWDZIWĄ PRZYCZYNĘ W TERMINALU:
    console.error("❌ BŁĄD ONBOARDINGU:", error.message || error);
    
    // Sprawdźmy czy to błąd unikalności (np. userId już zajęte)
    if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Ten użytkownik ma już profil pracownika.' });
    }
    
    res.status(500).json({ error: 'Błąd tworzenia profilu. Sprawdź konsolę serwera.' });
  }
});

// ============================================================
// KONFIGURACJA FILTRÓW (Interfejs)
// ============================================================
interface ReportFilters {
    status: 'ALL' | 'EXPIRED' | 'WARNING'; 
    categories: string[]; // np. ['UDT', 'SEP']
    specificTypes: string[]; // Nowe pole: konkretne nazwy
}

// ===================================================================================
// FUNKCJA GENERUJĄCA RAPORT (Serce systemu)
// ===================================================================================
// Domyślny filtr = WSZYSTKO (Dla Crona)
async function generateReportForUser(userId: number, filters: ReportFilters = { status: 'ALL', categories: [], specificTypes: [] }) {
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return null;

    const employees = await prisma.employee.findMany({ include: { compliance: true } });
    
    // Kontenery na dane
    const items: any[] = []; 
    const statsPerType: Record<string, { total: number, valid: number, warning: number, expired: number }> = {};

    let expiredCount = 0;
    let warningCount = 0;
    const today = new Date();

    employees.forEach(emp => {
      if (emp.compliance) {
          emp.compliance.forEach(c => {
            
            // 1. FILTROWANIE PO KATEGORIACH I TYPACH
            // Jeśli użytkownik wybrał kategorie, a ten element do nich nie należy -> POMIŃ
            if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(c.type)) return;
            // Jeśli użytkownik wybrał konkretne typy (np. Wózki), a nazwa się nie zgadza -> POMIŃ
            if (filters.specificTypes && filters.specificTypes.length > 0 && !filters.specificTypes.includes(c.name)) return;

            // Obliczenia daty
            const expiry = new Date(c.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let currentStatus = 'VALID';
            if (daysLeft <= 0) currentStatus = 'EXPIRED';
            else if (daysLeft <= 30) currentStatus = 'WARNING';

            // 2. FILTROWANIE PO STATUSIE (ZALEGŁE / WYGASAJĄCE / WSZYSTKIE)
            let include = false;
            if (filters.status === 'ALL') include = true; // Bierzemy też ważne (do inwentaryzacji uprawnień)
            else if (filters.status === 'EXPIRED' && currentStatus === 'EXPIRED') include = true;
            else if (filters.status === 'WARNING' && currentStatus === 'WARNING') include = true;

            if (include) {
                // Dodaj do listy (szczegóły dla tabeli)
                items.push({
                    employeeName: `${emp.firstName} ${emp.lastName}`,
                    complianceName: c.name,
                    expiryDate: c.expiryDate.toISOString().split('T')[0],
                    daysLeft: daysLeft,
                    category: c.type,
                    status: currentStatus
                });

                // Zlicz globalne liczniki (Tylko problemy wpływają na "kolor" raportu)
                if (currentStatus === 'EXPIRED') expiredCount++;
                if (currentStatus === 'WARNING') warningCount++;

                // Zlicz statystyki per TYP (Do wykresów słupkowych w PDF)
                // Np. Wózki: 5 osób, 3 ważne, 1 wygasa, 1 po terminie
                if (!statsPerType[c.name]) statsPerType[c.name] = { total: 0, valid: 0, warning: 0, expired: 0 };
                
                statsPerType[c.name].total++;
                if (currentStatus === 'VALID') statsPerType[c.name].valid++;
                if (currentStatus === 'WARNING') statsPerType[c.name].warning++;
                if (currentStatus === 'EXPIRED') statsPerType[c.name].expired++;
            }
          });
      }
    });

    // Przygotowanie JSONa do bazy
    const reportData = {
        items: items, // Lista płaska
        statsPerType: statsPerType, // Dane do wykresów
        meta: {
            filterStatus: filters.status,
            filterCategories: filters.categories,
            filterSpecifics: filters.specificTypes
        }
    };

    const report = await prisma.generatedReport.create({
      data: {
        totalStaff: employees.length,
        expiredCount,
        warningCount,
        detailsJson: JSON.stringify(reportData)
      }
    });

    // Powiadomienie
    let notifMessage = `Raport #${report.id} jest gotowy.`;
    // Jeśli to Cron (brak filtrów), daj znać że to automat
    if (filters.status === 'ALL' && filters.categories.length === 0) {
        notifMessage = `Raport automatyczny #${report.id} został wygenerowany.`;
    }

    await prisma.notification.create({
      data: {
        userId: userId,
        title: "Raport BHP",
        message: notifMessage,
        type: "REPORT",
        link: `/reports`
      }
    });

    return report;
}

// ============================================================
// ENDPOINT: Generowanie Ręczne (Przyjmuje filtry z Frontendu)
// ============================================================
app.post('/api/reports/generate-now', async (req, res) => {
  const { userId, filters } = req.body; 
  
  try {
    // Przekazujemy filtry z przycisku do funkcji
    const report = await generateReportForUser(Number(userId), filters);
    
    if (!report) return res.status(404).json({ error: 'Użytkownik nie istnieje.' });
    res.json({ success: true, reportId: report.id });
  } catch (error) {
    console.error("Błąd generowania:", error);
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// ============================================================
// SYSTEM AUTOMATYCZNY (CRON) - Sprawdza co minutę
// ============================================================
cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // 1. Pobierz obecny dzień (np. "MONDAY") i godzinę (np. "09:00")
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = days[now.getDay()];
    const currentTime = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

    console.log(`🕒 [ZEGAR] Sprawdzam zadania: ${currentDay} ${currentTime}`);

    // 2. Znajdź użytkowników, którzy mają włączony raport na TERAZ
    try {
        const usersToNotify = await prisma.user.findMany({
            where: {
                reportEnabled: true,
                reportDay: currentDay,
                reportTime: currentTime
            }
        });

        if (usersToNotify.length > 0) {
            console.log(`🚀 Znaleziono ${usersToNotify.length} raportów do wygenerowania.`);
            // 3. Dla każdego użytkownika wygeneruj raport
            for (const user of usersToNotify) {
                await generateReportForUser(user.id);
            }
        }
    } catch (error) {
        console.error("❌ Błąd w Cronie:", error);
    }
});

// --- GET: Pobierz ustawienia zalogowanego użytkownika (DEBUG) ---
app.get('/api/users/:id/settings', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { reportEnabled: true, reportDay: true, reportTime: true }
    });

    if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    res.json(user);
  } catch (error) {
    console.error("Błąd pobierania ustawień:", error);
    res.status(500).json({ error: 'Błąd pobierania ustawień' });
  }
});

// --- PUT: Aktualizuj ustawienia raportów (WERSJA Z LOGOWANIEM BŁĘDÓW) ---
app.put('/api/users/:id/settings', async (req, res) => {
  const { id } = req.params;
  const { reportEnabled, reportDay, reportTime } = req.body;

  try {
    await prisma.user.update({
      where: { id: Number(id) },
      data: { reportEnabled, reportDay, reportTime }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Błąd zapisu ustawień:", error);
    res.status(500).json({ error: 'Błąd zapisu ustawień' });
  }
});

// --- BRAKUJĄCY ENDPOINT: Pobierz powiadomienia ---
app.get('/api/notifications', async (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  
  if (!userId) return res.json([]);

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania powiadomień' });
  }
});

// --- ENDPOINT: Oznacz powiadomienie jako przeczytane (PUT) ---
app.put('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.notification.update({
      where: { id: Number(id) },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Błąd oznaczania powiadomienia:", error);
    res.status(500).json({ error: 'Błąd aktualizacji' });
  }
});

// --- NOWY ENDPOINT: Pobierz listę wygenerowanych raportów ---
app.get('/api/reports', async (req, res) => {
  console.log("🔍 Próba pobrania listy raportów z archiwum..."); 

  try {
    // Pobieramy raporty z tabeli GeneratedReport (nie z User!)
    const reports = await prisma.generatedReport.findMany({
      orderBy: { generatedAt: 'desc' } // Najnowsze na górze
    });

    console.log(`📦 Znaleziono raportów: ${reports.length}`);
    res.json(reports);
  } catch (error) {
    console.error("❌ Błąd serwera przy pobieraniu raportów:", error);
    res.status(500).json({ error: 'Błąd pobierania raportów' });
  }
});

// --- DELETE: Usuń raport z archiwum ---
app.delete('/api/reports/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.generatedReport.delete({
      where: { id: Number(id) }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Błąd usuwania raportu:", error);
    res.status(500).json({ error: 'Nie udało się usunąć raportu' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`--------------------------------------------------`);
  console.log(`🚀 SERWER API DZIAŁA!`);
  console.log(`➡️  Adres API: http://localhost:${PORT}/api/employees`);
  console.log(`--------------------------------------------------`);
});