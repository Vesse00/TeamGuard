import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { create } from 'domain';


const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY) {
  console.error("BŁĄD KRYTYCZNY: Brak zmiennej JWT_SECRET w pliku .env!");
  process.exit(1);
}

// --- KOD DLA MANAGERÓW (Możesz to przenieść do .env) ---
const MANAGER_REGISTRATION_CODE = process.env.MANAGER_CODE || 'MANAGER2024';


// ============================================================
// KONFIGURACJA EMAIL (NODEMAILER)
// ============================================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    // 👇👇👇 PAMIĘTAJ O SWOICH DANYCH 👇👇👇
    user: 'none.contactpl@gmail.com', 
    pass: 'kkno scpg qjpi uydh' // Użyj hasła aplikacji, jeśli masz 2FA   
  }
});

// --- FUNKCJA POMOCNICZA: Logowanie i Powiadamianie WSZYSTKICH ---
async function logAndNotifyAll(adminId: number, action: string, message: string, link: string | null = null, targetId: number | null = null) {
    try {
        // 1. Pobierz dane autora akcji
        const admin = await prisma.user.findUnique({ where: { id: adminId } });
        const adminName = admin ? `${admin.firstName} ${admin.lastName}` : "System";

        // 2. Zapisz w historii (AuditLog)
        await prisma.auditLog.create({
            data: {
                action,
                details: message,
                performedBy: adminName,
                targetId: targetId
            }
        });

        // 3. Wyślij powiadomienie do WSZYSTKICH użytkowników
        const notificationMessage = `${adminName}: ${message}`;
        const allUsers = await prisma.user.findMany();
        
        // Tworzymy powiadomienia dla każdego (używając Promise.all dla szybkości)
        await Promise.all(allUsers.map(user => {
            return prisma.notification.create({
                data: {
                    userId: user.id,
                    title: action, // np. "Aktualizacja Uprawnień"
                    message: notificationMessage, // np. "Jan Kowalski odnowił..."
                    type: "INFO",
                    link: link
                }
            });
        }));

    } catch (e) {
        console.error("Błąd logowania akcji:", e);
    }
}

// ============================================================
// 2. LOGIKA WYSYŁANIA MAILA (TYLKO PROBLEMY)
// ============================================================
// Funkcja sprawdzająca alerty (z obsługą trybu testowego)
async function checkAlertsForUser(userId: number, isTest: boolean = false) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.email) return;

    // Pobierz dane
    const employees = await prisma.employee.findMany({ include: { compliance: true } });
    let expired = 0;
    let warning = 0;
    const today = new Date();

    employees.forEach(emp => {
        emp.compliance.forEach(c => {
            const expiry = new Date(c.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (daysLeft <= 0) expired++;
            else if (daysLeft <= 30) warning++;
        });
    });

    // Decyzja o wysłaniu
    const hasIssues = expired > 0 || warning > 0;

    // Jeśli to automat (nie test) i brak problemów -> STOP
    if (!isTest && !hasIssues) {
        console.log(`[ALERT] ${user.email} - Czysto. Nie wysyłam.`);
        return;
    }

    console.log(`[ALERT] Wysyłam maila do ${user.email} (Zaległe: ${expired}, Test: ${isTest})`);

    // Treść maila
    let subject = '';
    let color = '';
    let title = '';
    let message = '';

    if (expired > 0) {
        subject = `🚨 ALERT BHP: Masz ${expired} zaległych uprawnień!`;
        color = '#ef4444'; // Czerwony
        title = 'WYMAGANA INTERWENCJA';
        message = `Wykryto uprawnienia <strong>po terminie</strong> dla <strong>${expired}</strong> pracowników.<br>Wymagane działanie.`;
    } else if (warning > 0) {
        subject = `⚠️ OSTRZEŻENIE BHP: ${warning} uprawnień wygasa.`;
        color = '#f97316'; // Pomarańczowy
        title = 'ZBLIŻAJĄ SIĘ TERMINY';
        message = `Uprawnienia kończą się w ciągu 30 dni dla <strong>${warning}</strong> pracowników.`;
    } else {
        // Tylko dla testu gdy jest zielono
        subject = `✅ TEST ALERTU: System działa poprawnie`;
        color = '#22c55e'; // Zielony
        title = 'TEST POŁĄCZENIA';
        message = `To jest wiadomość testowa. Twój system powiadomień działa poprawnie.<br>W bazie nie ma obecnie zaległości.`;
    }

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: ${color}; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">${title}</h1>
            </div>
            <div style="padding: 30px;">
                <p>Cześć <strong>${user.firstName || 'Administratorze'}</strong>,</p>
                <p>${message}</p>
                ${hasIssues ? `<p>🔴 Zaległe: ${expired}<br>🟠 Wygasające: ${warning}</p>` : ''}
                <br>
                <a href="http://localhost:5173" style="background-color: #0f172a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Otwórz Panel</a>
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: '"TeamGuard" <noreply@teamguard.com>',
            to: user.email,
            subject: subject,
            html: htmlContent
        });
    } catch (e) { console.error("Błąd maila:", e); }
}

// --- ALERT TESTOWY (Fix błędu połączenia) ---
app.post('/api/alerts/test-now', async (req, res) => {
    const { userId } = req.body;
    try {
        // Wywołujemy z flagą TRUE (wymuś wysłanie)
        await checkAlertsForUser(Number(userId), true);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// --- GET: Szczegóły pracownika ---
app.get('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const employee = await prisma.employee.findUnique({
    where: { id: Number(id) },
    include: { 
      compliance: true,
      user: true 
    }
  });
  if(!employee) return res.status(404).json({ error: 'Nie znaleziono pracownika' });
  res.json(employee);
});

// --- POST: Dodaj pracownika (Z LOGOWANIEM) ---
app.post('/api/employees', async (req, res) => {
  const { firstName, lastName, position, email, hiredAt, department, adminId } = req.body;
  
  // Helpery (bez zmian)
  const getInitials = (f: string, l: string) => `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  const calculateExpiry = (start: Date, years: string) => {
     const date = new Date(start);
     if (years === '0.5') date.setMonth(date.getMonth() + 6);
     else date.setFullYear(date.getFullYear() + parseInt(years));
     return date;
  };

  try {

    // Sprawdzamy czy pracownik o takim emailu już istnieje
    const existingEmp = await prisma.employee.findUnique({ where: { email } });
    
    if (existingEmp) {
        return res.status(400).json({ error: 'Pracownik z tym adresem email już istnieje!' });
    }

    // 1. Sprawdź czy User już istnieje
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Użytkownik z tym mailem już istnieje w systemie.' });

    // 2. Generuj token zaproszenia
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // 3. Stwórz USERA (z rolą USER i tokenem)
    const newUser = await prisma.user.create({
        data: {
            firstName,
            lastName,
            email,
            password: await bcrypt.hash(crypto.randomBytes(10).toString('hex'), 10), // Tymczasowe losowe hasło
            role: 'USER',
            inviteToken: inviteToken
        }
    });

    // 4. Stwórz PRACOWNIKA (połączonego z Userem)
    const newEmployee = await prisma.employee.create({
      data: {
        firstName, lastName, position, email,
        department: department || 'Ogólny',
        hiredAt: new Date(hiredAt),
        avatarInitials: getInitials(firstName, lastName),
        userId: newUser.id, // <--- ŁĄCZYMY KONTA
        compliance: {
            create: [
                { name: 'Szkolenie BHP', type: 'MANDATORY', status: 'VALID', issueDate: new Date(hiredAt), duration: '0.5', expiryDate: calculateExpiry(new Date(hiredAt), '0.5') },
                { name: 'Badania Lekarskie', type: 'MANDATORY', status: 'VALID', issueDate: new Date(hiredAt), duration: '2', expiryDate: calculateExpiry(new Date(hiredAt), '2') }
            ]
        }
      }
    });

    // 5. Wyślij Email z zaproszeniem
    const inviteLink = `http://localhost:5173/login?token=${inviteToken}`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Witaj w TeamGuard!</h2>
            <p>Administrator utworzył dla Ciebie konto pracownicze.</p>
            <p>Kliknij poniższy przycisk, aby ustawić hasło i się zalogować:</p>
            <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 20px 0;">Aktywuj Konto</a>
            <p style="color: #64748b; font-size: 12px;">Link jest jednorazowy.</p>
        </div>
    `;

    // Opakowane w try-catch, żeby błąd maila nie wywalił całego requestu (opcjonalne, ale bezpieczne)
    try {
        await transporter.sendMail({
            from: '"TeamGuard" <noreply@teamguard.com>',
            to: email,
            subject: '✉️ Zaproszenie do systemu TeamGuard',
            html: htmlContent
        });
    } catch (mailError) {
        console.error("Błąd wysyłania maila przy dodawaniu:", mailError);
        // Nie robimy return, bo pracownik się dodał, najwyżej wyślemy zaproszenie ręcznie później
    }

    // 6. Logowanie akcji (dla Admina)
    if (adminId) {
        const msg = `Dodano pracownika i wysłano zaproszenie: ${firstName} ${lastName}. (${position}, Dział: ${department || 'Ogólny'}).`;
        await logAndNotifyAll(Number(adminId), "Nowy Pracownik", msg, `/employees/${newEmployee.id}`, newEmployee.id);
    }

    res.json(newEmployee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd tworzenia konta pracownika' });
  }
});

// --- POST: Ręczne wysyłanie zaproszenia (Styl Crypto & Bcrypt) ---
app.post('/api/employees/:id/invite', async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.body;

  try {
    // 1. Znajdź pracownika (i sprawdź czy ma już Usera)
    const emp = await prisma.employee.findUnique({
      where: { id: Number(id) },
      include: { user: true }
    });

    if (!emp) return res.status(404).json({ error: 'Pracownik nie istnieje' });

    // Jeśli User istnieje I nie ma tokenu zaproszenia (czyli został zużyty/wyczyszczony), to znaczy że jest aktywny.
    if (emp.user && emp.user.inviteToken === null) {
        return res.status(400).json({ error: 'Ten pracownik ma już aktywne konto i ustawił hasło.' });
    }

    // 2. Generuj token zaproszenia (Crypto)
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // 3. Obsługa Usera (Stwórz nowego lub zaktualizuj istniejącego)
    let userId = emp.userId;

    if (userId) {
        // SCENARIUSZ A: User już istnieje -> Tylko aktualizujemy token
        await prisma.user.update({
            where: { id: userId },
            data: { inviteToken: inviteToken }
        });
    } else {
        // SCENARIUSZ B: Brak Usera -> Tworzymy go (Tak jak przy dodawaniu pracownika)
        
        // Generujemy losowe hasło tymczasowe
        const tempPassword = crypto.randomBytes(10).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const newUser = await prisma.user.create({
            data: {
                firstName: emp.firstName,
                lastName: emp.lastName,
                email: emp.email,
                password: hashedPassword,
                role: 'USER',
                inviteToken: inviteToken
            }
        });
        userId = newUser.id;

        // Łączymy pracownika z nowym userem
        await prisma.employee.update({
            where: { id: emp.id },
            data: { userId }
        });
    }

    // 4. Wyślij Email (Twój szablon HTML)
    const inviteLink = `http://localhost:5173/login?token=${inviteToken}`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Witaj w TeamGuard!</h2>
            <p>Administrator wysłał do Ciebie nowe zaproszenie do systemu.</p>
            <p>Kliknij poniższy przycisk, aby ustawić hasło i się zalogować:</p>
            <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 20px 0;">Aktywuj Konto</a>
            <p style="color: #64748b; font-size: 12px;">Link jest jednorazowy.</p>
        </div>
    `;

    await transporter.sendMail({
        from: '"TeamGuard" <noreply@teamguard.com>',
        to: emp.email,
        subject: '✉️ Zaproszenie do systemu TeamGuard',
        html: htmlContent
    });

    // 5. Logowanie akcji
    if (adminId) {
        const msg = `Wysłano ręczne zaproszenie dla pracownika: ${emp.firstName} ${emp.lastName}.`;
        await logAndNotifyAll(Number(adminId), "Wysłano Zaproszenie", msg, `/employees/${id}`, Number(id));
    }

    res.json({ success: true, message: 'Zaproszenie wysłane pomyślnie' });

  } catch (error) {
    console.error("Błąd wysyłania zaproszenia:", error);
    res.status(500).json({ error: 'Nie udało się wysłać zaproszenia' });
  }
});

// --- PUT: Edycja danych pracownika ---
// --- PUT: Edycja danych pracownika (Z PEŁNYM LOGOWANIEM) ---
app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, position, email, hiredAt, department, adminId } = req.body; // Pamiętaj, by frontend wysyłał adminId!

  try {
    // 1. Pobierz stare dane
    const oldEmp = await prisma.employee.findUnique({ where: { id: Number(id) } });
    if (!oldEmp) return res.status(404).json({ error: 'Pracownik nie istnieje' });

    // 2. Aktualizuj
    const updated = await prisma.employee.update({
      where: { id: Number(id) },
      data: { firstName, lastName, position, email, department,
         hiredAt: new Date(hiredAt) }
    });

    // 3. WYKRYWANIE ZMIAN (Dla logów)
    if (adminId) {
        const changes = [];
        if (oldEmp.firstName !== firstName) changes.push(`Imię: ${oldEmp.firstName} -> ${firstName}`);
        if (oldEmp.lastName !== lastName)   changes.push(`Nazwisko: ${oldEmp.lastName} -> ${lastName}`);
        if (oldEmp.position !== position)   changes.push(`Stanowisko: ${oldEmp.position} -> ${position}`);
        if (oldEmp.email !== email)         changes.push(`Email: ${oldEmp.email} -> ${email}`);
        if (oldEmp.department !== department) changes.push(`Dział: ${oldEmp.department} -> ${department}`);
        
        if (changes.length > 0) {
            const msg = `Edytowano dane pracownika ${firstName} ${lastName}. Zmiany: ${changes.join(', ')}`;
            // Używamy naszej funkcji pomocniczej
            await logAndNotifyAll(Number(adminId), "Edycja Danych", msg, `/employees/${id}`, Number(id));
        }
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd aktualizacji' });
  }
});

// --- DELETE: Usuń pracownika (Z blokadą Admina) ---
app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  
  
  // Pobieramy ID admina z adresu URL (req.query) lub body
  const rawAdminId = req.query.adminId || req.body.adminId;
  const adminId = rawAdminId ? Number(rawAdminId) : null;

  try {
    // KROK 1: POBIERZ DANE PRZED USUNIĘCIEM
    // Musimy to zrobić teraz, bo za chwilę rekord zniknie!
    const emp = await prisma.employee.findUnique({ 
        where: { id: Number(id) } 
    });
    
    if (!emp) return res.status(404).json({ error: 'Pracownik nie istnieje' });

    // Zabezpieczenie przed usunięciem głównego admina
    if (emp.isSystemAdmin) {
        return res.status(403).json({ error: 'Nie można usunąć konta Administratora Głównego.' });
    }

    const linkedUserId = emp.userId;
    // KROK 2: TERAZ USUŃ
    await prisma.employee.delete({ where: { id: Number(id) } });

    if (linkedUserId) {
        await prisma.user.delete({ where: { id: linkedUserId } });
    }
    
    // KROK 3: ZAPISZ W LOGACH (Używając danych pobranych w Kroku 1)
    if (adminId) {
        // Tu mamy dostęp do emp.firstName, mimo że w bazie go już nie ma
        const msg = `Usunięto pracownika: ${emp.firstName} ${emp.lastName} (Stanowisko: ${emp.position}).`;
        
        await logAndNotifyAll(
            adminId, 
            "Usunięcie Pracownika", // To da czerwony kolor w logach
            msg, 
            null, // Brak linku, bo profil usunięty
            null
        );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Błąd usuwania pracownika:", error);
    res.status(500).json({ error: 'Błąd usuwania' });
  }
});

app.get('/api/employees', async (req, res) => {
  const { search } = req.query;
  const where = search ? { OR: [{ firstName: { contains: String(search) } }, { lastName: { contains: String(search) } }] } : {};
  
  try {
    const emps = await prisma.employee.findMany({ 
        where, 
        include: { compliance: true }, 
        orderBy: { createdAt: 'desc' } 
    });
    res.json(emps);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania listy pracowników' });
  }
});

// ============================================================
// ENDPOINTY: UPRAWNIENIA (COMPLIANCE)
// ============================================================

// --- POST: Dodaj uprawnienie ---
// --- POST: Dodaj uprawnienie (LOGOWANIE DLA KAŻDEGO TYPU) ---
app.post('/api/compliance', async (req, res) => {
  const { name, expiryDate, issueDate, duration, status, employeeId, type, adminId } = req.body;
  
  try {
    const newCompliance = await prisma.complianceEvent.create({
      data: {
        name, // To może być BHP, ale też "Wózek widłowy" - nazwa jest dynamiczna
        status: status || 'VALID',
        type: type || 'OTHER',
        employeeId: Number(employeeId),
        expiryDate: new Date(expiryDate),
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        duration: duration ? String(duration) : "1"
      }
    });

    // LOGOWANIE
    if (adminId) {
        // Pobierz imię pracownika dla ładnego logu
        const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) } });
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : `Pracownik #${employeeId}`;
        
        const msg = `Dodano nowe uprawnienie: "${name}" dla ${empName}.`;
        await logAndNotifyAll(Number(adminId), "Nowe Uprawnienie", msg, `/employees/${employeeId}`, Number(employeeId));
    }

    res.json(newCompliance);
  } catch (error) {
    res.status(500).json({ error: 'Błąd dodawania uprawnienia' });
  }
});

// --- PUT: Edytuj/Odnów uprawnienie (Z LOGOWANIEM) ---
app.put('/api/compliance/:id', async (req, res) => {
  const { id } = req.params;
  // Dodajemy adminId do body (musimy to wysłać z frontu)
  const { expiryDate, issueDate, duration, adminId } = req.body; 

  try {
    // 1. Pobierz stare dane (żeby wiedzieć czyje to uprawnienie)
    const oldCompliance = await prisma.complianceEvent.findUnique({
        where: { id: Number(id) },
        include: { employee: true } // Pobieramy też dane pracownika
    });

    if (!oldCompliance) return res.status(404).json({ error: 'Brak uprawnienia' });

    // 2. Aktualizacja
    const updated = await prisma.complianceEvent.update({
      where: { id: Number(id) },
      data: {
        expiryDate: new Date(expiryDate),
        ...(issueDate && { issueDate: new Date(issueDate) }),
        ...(duration && { duration: String(duration) }),
        status: 'VALID'
      }
    });

    // 3. LOGIKA POWIADOMIENIA (Jeśli mamy ID admina)
    if (adminId && oldCompliance?.employee) {
        const empName = `${oldCompliance.employee.firstName} ${oldCompliance.employee.lastName}`;
        // Sprawdzamy czy to odnowienie (czy data się zmieniła na przyszłość)
        const isRenewal = new Date(expiryDate) > new Date(oldCompliance.expiryDate);
        const actionType = isRenewal ? "Odnowienie Uprawnień" : "Edycja Uprawnień";
        const msg = `Zaktualizowano ${oldCompliance.name} dla ${empName}.`;
        
        await logAndNotifyAll(Number(adminId), actionType, msg, `/employees/${oldCompliance.employeeId}`, oldCompliance.employeeId);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd edycji uprawnienia' });
  }
});

// --- DELETE: Usuń UPRAWNIENIE ---
// --- DELETE: Usuń UPRAWNIENIE (Z PEŁNYM LOGOWANIEM) ---
app.delete('/api/compliance/:id', async (req, res) => {
  const { id } = req.params;
  // Pobieramy adminId z query (np. ?adminId=1) LUB z body (zależnie jak wyśle frontend)
  const rawAdminId = req.query.adminId || req.body.adminId;
  const adminId = rawAdminId ? Number(rawAdminId) : null;

  try {
    // 1. POBIERZ DANE PRZED USUNIĘCIEM (Ważne!)
    const itemToDelete = await prisma.complianceEvent.findUnique({
        where: { id: Number(id) },
        include: { employee: true } // Musimy wiedzieć czyje to było
    });

    if (!itemToDelete) {
        return res.status(404).json({ error: 'Uprawnienie nie istnieje' });
    }

    // 2. USUŃ REKORD
    await prisma.complianceEvent.delete({
      where: { id: Number(id) }
    });

    // 3. LOGOWANIE AKCJI
    if (adminId) {
        const empName = itemToDelete.employee 
            ? `${itemToDelete.employee.firstName} ${itemToDelete.employee.lastName}` 
            : 'Pracownik';

        const msg = `Usunięto uprawnienie: "${itemToDelete.name}" pracownikowi ${empName}.`;
        
        // Zapisz w logach
        await logAndNotifyAll(
            Number(adminId), 
            "Usunięcie Uprawnienia", 
            msg, 
            `/employees/${itemToDelete.employeeId}`, 
            itemToDelete.employeeId
        );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Błąd usuwania uprawnienia:", error);
    res.status(500).json({ error: 'Nie udało się usunąć uprawnienia' });
  }
});

// ============================================================
// ENDPOINTY: AUTORYZACJA (LOGIN/REGISTER/ONBOARDING)
// ============================================================

// --- REJESTRACJA ---
app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, password, adminCode } = req.body;

  if (adminCode !== MANAGER_REGISTRATION_CODE) {
      return res.status(403).json({ error: 'Błędny kod autoryzacji dla Managera.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Nieprawidłowy format adresu email.' });

  const passwordRegex = /[!@#$%^&*(),.?":{}|<>]/; 
  if (password.length < 8 || !passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Hasło musi mieć min. 8 znaków i znak specjalny.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Użytkownik o tym emailu już istnieje' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { 
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: 'ADMIN', // <--- Nadajemy uprawnienia Admina
        inviteToken: null // Konto od razu aktywne }
    }
  });

    res.json({ message: 'Użytkownik utworzony pomyślnie', userId: user.id });
  } catch (error) {
    console.error("Błąd rejestracji:", error);
    res.status(500).json({ error: 'Błąd rejestracji' });
  }
});

// --- LOGOWANIE ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  // 1. Logujemy, że przyszło zapytanie (nie logujemy hasła dla bezpieczeństwa!)
  console.log(`[LOGIN DEBUG] Próba logowania dla: ${email}`);
  try {
    const user = await prisma.user.findUnique({ 
        where: { email },
        include: { employee: true } // Pobieramy powiązanego pracownika
    });
    
    if (!user) return res.status(400).json({ error: 'Nieprawidłowy email lub hasło' });
    
    // Obsługa konta oczekującego na akceptację zaproszenia
    if (user.inviteToken) return res.status(400).json({ error: 'Konto nieaktywne. Sprawdź email z zaproszeniem.' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ error: 'Nieprawidłowy email lub hasło' });

    const token = jwt.sign({ userId: user.id, role: user.role }, SECRET_KEY as string, { expiresIn: '8h' });
    
    // Znajdź ID pracownika powiązanego z tym userem (do linku "Mój Profil")
    const employeeId = user.employee ? user.employee.id : null;

    const position = user.employee ? user.employee.position : (user.role === 'ADMIN' ? 'Administrator' : 'Pracownik');

    res.json({ 
        token, 
        user: { 
            id: user.id, 
            firstName: user.firstName, 
            lastName: user.lastName, 
            email: user.email,
            role: user.role,       // <--- WAŻNE
            employeeId: employeeId, // <--- WAŻNE
            position: position          // <--- WAŻNE (dla wyświetlania roli w UI)
        } 
    });
  } catch (error) { res.status(500).json({ error: 'Błąd logowania' }); }
});

app.post('/api/auth/set-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const user = await prisma.user.findFirst({ where: { inviteToken: token } });
        if (!user) return res.status(400).json({ error: 'Nieprawidłowy lub wygasły token zaproszenia.' });

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                inviteToken: null // Kasujemy token, konto aktywne
            }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Błąd ustawiania hasła.' });
    }
});
// --- WERYFIKACJA TOKENA (Dla LoginPage) ---
app.get('/api/auth/verify-invite', async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Brak tokena' });

    try {
        const user = await prisma.user.findFirst({ 
            where: { inviteToken: token } 
        });

        if (!user) return res.status(400).json({ error: 'Link jest nieważny lub wygasł.' });

        // Zwracamy tylko imię i nazwisko, aby przywitać użytkownika
        res.json({ 
            firstName: user.firstName, 
            lastName: user.lastName, 
            email: user.email 
        });
    } catch (e) { res.status(500).json({ error: 'Błąd serwera' }); }
});

// --- ONBOARDING ADMINA ---
app.post('/api/employees/onboarding', async (req, res) => {
  const { userId, firstName, lastName, email, position, hiredAt, bhpDate, medicalDate, bhpDuration, medicalDuration, skipped, adminId } = req.body;
  
  const getInitials = (f: string, l: string) => `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const calculateExpiry = (startStr: string, years: string) => {
     if (!startStr) return yesterday;
     const date = new Date(startStr);
     if (years === '0.5') date.setMonth(date.getMonth() + 6);
     else date.setFullYear(date.getFullYear() + parseInt(years));
     return date;
  };

  try {
    const newEmployee = await prisma.employee.create({
      data: {
        firstName, lastName, email,
        position: position || 'Administrator',
        hiredAt: hiredAt ? new Date(hiredAt) : new Date(),
        avatarInitials: getInitials(firstName, lastName),
        isSystemAdmin: true,
        userId: userId,
        compliance: {
          create: [
             { 
               name: 'Szkolenie BHP', type: 'MANDATORY', 
               status: skipped ? 'EXPIRED' : 'VALID',
               issueDate: (skipped || !bhpDate) ? yesterday : new Date(bhpDate || new Date()), 
               expiryDate: skipped ? yesterday : calculateExpiry(bhpDate, bhpDuration || '5'),
               duration: bhpDuration || '5' 
             },
             { 
               name: 'Badania Lekarskie', type: 'MANDATORY', 
               status: skipped ? 'EXPIRED' : 'VALID',
               issueDate: (skipped || !medicalDate) ? yesterday : new Date(medicalDate || new Date()),
               expiryDate: skipped ? yesterday : calculateExpiry(medicalDate, medicalDuration || '2'),
               duration: medicalDuration || '2'
             }
          ]
        }
      }
    });
    res.json(newEmployee);
  } catch (error) {
    console.error("Błąd onboardingu:", error);
    res.status(500).json({ error: 'Błąd tworzenia profilu pracownika' });
  }
});

// --- NOWY ENDPOINT: Aktualizacja profilu (Imię, Nazwisko, Email) ---
app.put('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { firstName, lastName, email }
    });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Błąd aktualizacji profilu:", error);
    res.status(500).json({ error: 'Nie udało się zaktualizować danych w bazie.' });
  }
});

// ============================================================
// LOGIKA RAPORTOWANIA (NOWA FUNKCJONALNOŚĆ)
// ============================================================

interface ReportFilters {
    status: 'ALL' | 'EXPIRED' | 'WARNING'; 
    categories: string[]; 
    specificTypes: string[]; 
}

// Funkcja generująca raport (Z obsługą filtrów i inwentaryzacji)
async function generateReportForUser(userId: number, filters: ReportFilters = { status: 'ALL', categories: [], specificTypes: [] }) {
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return null;

    const employees = await prisma.employee.findMany({ include: { compliance: true } });
    
    // Kontenery na dane
    const items: any[] = []; 
    // Statystyki do wykresów (Total, Valid, Warning, Expired)
    const statsPerType: Record<string, { total: number, valid: number, warning: number, expired: number }> = {};

    let expiredCount = 0;
    let warningCount = 0;
    const today = new Date();

    employees.forEach(emp => {
      if (emp.compliance) {
          emp.compliance.forEach(c => {
            
            // 1. FILTROWANIE (Kategorie i Typy)
            if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(c.type)) return;
            if (filters.specificTypes && filters.specificTypes.length > 0 && !filters.specificTypes.includes(c.name)) return;

            // Obliczenia
            const expiry = new Date(c.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let currentStatus = 'VALID';
            if (daysLeft <= 0) currentStatus = 'EXPIRED';
            else if (daysLeft <= 30) currentStatus = 'WARNING';

            // 2. FILTROWANIE (Status)
            let include = false;
            if (filters.status === 'ALL') include = true; // Bierzemy wszystko (nawet ważne)
            else if (filters.status === 'EXPIRED' && currentStatus === 'EXPIRED') include = true;
            else if (filters.status === 'WARNING' && currentStatus === 'WARNING') include = true;

            if (include) {
                // Dodaj do listy płaskiej
                items.push({
                    employeeName: `${emp.firstName} ${emp.lastName}`,
                    complianceName: c.name,
                    expiryDate: c.expiryDate.toISOString().split('T')[0],
                    daysLeft: daysLeft,
                    category: c.type,
                    status: currentStatus
                });

                // Zlicz globalne liczniki (tylko problemy)
                if (currentStatus === 'EXPIRED') expiredCount++;
                if (currentStatus === 'WARNING') warningCount++;

                // Zbieraj statystyki do wykresów (dla inwentaryzacji)
                if (!statsPerType[c.name]) statsPerType[c.name] = { total: 0, valid: 0, warning: 0, expired: 0 };
                statsPerType[c.name].total++;
                
                if (currentStatus === 'VALID') statsPerType[c.name].valid++;
                if (currentStatus === 'WARNING') statsPerType[c.name].warning++;
                if (currentStatus === 'EXPIRED') statsPerType[c.name].expired++;
            }
          });
      }
    });

    const reportData = {
        items: items,
        statsPerType: statsPerType,
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

    // Powiadomienie (Inny tekst dla automatu, inny dla ręcznego)
    let notifMessage = `Raport #${report.id} jest gotowy.`;
    // Jeśli status=ALL i brak kategorii = Cron (Automat)
    if (filters.status === 'ALL' && (!filters.categories || filters.categories.length === 0)) {
        notifMessage = `Raport automatyczny #${report.id} został wygenerowany.`;
    }

    await prisma.notification.create({
      data: {
        userId: userId,
        title: "Raport gotowy",
        message: notifMessage,
        type: "REPORT",
        link: `/reports`
      }
    });

    return report;
}

// --- ENDPOINT: Generowanie Ręczne (Przyjmuje filtry z Frontendu) ---
app.post('/api/reports/generate-now', async (req, res) => {
  const { userId, filters } = req.body; 
  try {
    const report = await generateReportForUser(Number(userId), filters);
    if (!report) return res.status(404).json({ error: 'Użytkownik nie istnieje.' });
    res.json({ success: true, reportId: report.id });
  } catch (error) {
    console.error("Błąd generowania:", error);
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// --- ENDPOINT: Pobierz listę raportów ---
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await prisma.generatedReport.findMany({
      orderBy: { generatedAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania raportów' });
  }
});

// --- ENDPOINT: Usuń raport ---
app.delete('/api/reports/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.generatedReport.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się usunąć raportu' });
  }
});


// ============================================================
// CRON: AUTOMATYCZNE RAPORTY
// ============================================================
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = days[now.getDay()];
    const currentTime = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

    //console.log(`🕒 [ZEGAR] Sprawdzam zadania: ${currentDay} ${currentTime}`);

    try {
        const usersToNotify = await prisma.user.findMany({
            where: { reportEnabled: true, reportDay: currentDay, reportTime: currentTime }
        });

        if (usersToNotify.length > 0) {
            console.log(`🚀 Generowanie ${usersToNotify.length} automatycznych raportów...`);
            for (const user of usersToNotify) {
                // Wywołanie BEZ filtrów = Domyślnie WSZYSTKO (Status ALL, Kategorie Puste)
                await generateReportForUser(user.id);
            }
        }
    } catch (error) {
        console.error("❌ Błąd w Cronie:", error);
    }
});

// --- EKSPORT DO EXCELA (XLSX) Z KOLORAMI I STYLAMI ---
app.get('/api/reports/export-excel', async (req, res) => {
  try {
    // 1. Pobieramy dane
    const { ids } = req.query;

    const where: any = {};
    if (ids) {
        // Zamieniamy "1,2,3" na tablicę liczb [1, 2, 3]
        const idList = String(ids).split(',').map(Number);
        where.id = { in: idList };
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { compliance: true },
      orderBy: { lastName: 'asc' } // Sortujemy alfabetycznie
    });

    // 2. Tworzymy zeszyt Excela
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raport Uprawnień');

    // 3. Definiujemy kolumny i ich szerokość
    sheet.columns = [
      { header: 'Imię', key: 'firstName', width: 15 },
      { header: 'Nazwisko', key: 'lastName', width: 20 },
      { header: 'Stanowisko', key: 'position', width: 25 },
      { header: 'Typ', key: 'type', width: 15 },
      { header: 'Nazwa Uprawnienia', key: 'name', width: 30 },
      { header: 'Data Ważności', key: 'expiryDate', width: 15 },
      { header: 'Dni do końca', key: 'daysLeft', width: 15 },
      { header: 'Status', key: 'status', width: 20 },
    ];

    // 4. Stylujemy nagłówek (Pogrubienie, Szare tło)
    sheet.getRow(1).font = { bold: true, size: 12 };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' } // Jasnoszary
    };

    // 5. Dodajemy dane i kolorujemy wiersze
    employees.forEach(emp => {
      if (emp.compliance.length === 0) {
        sheet.addRow({
            firstName: emp.firstName,
            lastName: emp.lastName,
            position: emp.position,
            type: '-', name: '-', expiryDate: '-', daysLeft: '-', status: 'BRAK DANYCH'
        });
      } else {
        emp.compliance.forEach(comp => {
            const today = new Date();
            const expiry = new Date(comp.expiryDate);
            const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            let statusText = 'WAŻNE';
            let statusColor = 'FFDCFCE7'; // Zielony (ARGB)
            
            if (daysLeft < 0) {
                statusText = 'PRZETERMINOWANE';
                statusColor = 'FFFEE2E2'; // Czerwony
            } else if (daysLeft < 30) {
                statusText = 'WYGASA WKRÓTCE';
                statusColor = 'FFFFEDD5'; // Pomarańczowy
            }

            const row = sheet.addRow({
                firstName: emp.firstName,
                lastName: emp.lastName,
                position: emp.position,
                type: comp.type === 'MANDATORY' ? 'Obowiązkowe' : 'Dodatkowe',
                name: comp.name,
                expiryDate: expiry.toISOString().split('T')[0],
                daysLeft: daysLeft,
                status: statusText
            });

            // Kolorowanie komórki "Status"
            const statusCell = row.getCell('status');
            statusCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: statusColor }
            };
            statusCell.font = { bold: true };
            
            // Wyśrodkowanie danych
            row.getCell('expiryDate').alignment = { horizontal: 'center' };
            row.getCell('daysLeft').alignment = { horizontal: 'center' };
            statusCell.alignment = { horizontal: 'center' };
        });
      }
    });

    // 6. Dodajemy obramowanie do wszystkich komórek z danymi
    sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // 7. Wysyłamy plik
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Raport_TeamGuard.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Błąd Excel:", error);
    res.status(500).send('Błąd generowania Excela');
  }
});


// ============================================================
// POZOSTAŁE ENDPOINTY (Ustawienia, Powiadomienia)
// ============================================================

app.get('/api/users/:id/settings', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { 
        reportEnabled: true, 
        reportDay: true, 
        reportTime: true,
        emailEnabled: true, // Dodane
        emailDays: true,    // Dodane
        emailTime: true }
    });
    if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: 'Błąd pobierania ustawień' }); }
});

app.put('/api/users/:id/settings', async (req, res) => {
  const { id } = req.params;
  const { 
    reportEnabled, reportDay, reportTime,
    emailEnabled, emailDays, emailTime
   } = req.body;
  try {
    await prisma.user.update({
      where: { id: Number(id) },
      data: { 
        reportEnabled, reportDay, reportTime,
        emailEnabled, emailDays, emailTime}
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Błąd zapisu ustawień' }); }
});

app.get('/api/notifications', async (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  if (!userId) return res.json([]);
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (error) { res.status(500).json({ error: 'Błąd pobierania powiadomień' }); }
});

// --- POBIERANIE POWIADOMIEŃ UŻYTKOWNIKA ---
app.get('/api/notifications/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: 'Nieprawidłowe ID użytkownika' });
    }

    try {
        const notifications = await prisma.notification.findMany({
            where: { 
                userId: userId // <--- KLUCZOWE: Filtrujemy po ID użytkownika
            },
            orderBy: { 
                createdAt: 'desc' // Najnowsze na górze
            },
            take: 5 // Ograniczamy do 10 ostatnich, żeby nie zaśmiecać paska
        });

        res.json(notifications);
    } catch (error) {
        console.error("Błąd pobierania powiadomień:", error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// --- OZNACZANIE WSZYSTKICH JAKO PRZECZYTANE ---
app.post('/api/notifications/:userId/read-all', async (req, res) => {
    const userId = parseInt(req.params.userId);
    try {
        await prisma.notification.updateMany({
            where: { userId: userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Błąd aktualizacji' });
    }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.notification.update({ where: { id: Number(id) }, data: { isRead: true } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Błąd aktualizacji' }); }
});

// --- ENDPOINT: Oznacz WSZYSTKIE jako przeczytane ---
app.put('/api/notifications/read-all', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
      return res.status(400).json({ error: 'Brak ID użytkownika' });
  }

  try {
    await prisma.notification.updateMany({
      where: {
        userId: Number(userId),
        isRead: false // Aktualizujemy tylko te, które są nieprzeczytane
      },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Błąd oznaczania wszystkich powiadomień:", error);
    res.status(500).json({ error: 'Błąd bazy danych' });
  }
});

// --- ZMIANA HASŁA (Z PEŁNĄ WALIDACJĄ) ---
app.put('/api/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // 1. Walidacja "Świętego Obowiązku" po stronie serwera
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isValidLength = newPassword.length >= 8;

  if (!isValidLength || !hasNumber || !hasSpecial) {
      return res.status(400).json({ 
          error: 'Hasło jest za słabe. Wymagane: 8 znaków, cyfra i znak specjalny.' 
      });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.status(400).json({ error: 'Obecne hasło jest nieprawidłowe' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: Number(id) },
        data: { password: hashedPassword }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Błąd zmiany hasła:", error);
    res.status(500).json({ error: 'Błąd serwera przy zmianie hasła' });
  }
});

// ============================================================
// NOWE: ODZYSKIWANIE HASŁA
// ============================================================

// Krok 1: Wyślij kod weryfikacyjny (BEZPIECZNA WERSJA)
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: 'Nie znaleziono użytkownika o takim adresie email.' });

        // --- ZMIANA NA CRYPTO ---
        // Generuje kryptograficznie bezpieczną liczbę całkowitą z zakresu <100000, 1000000)
        // Dzięki temu mamy pewność, że to zawsze 6 cyfr i jest to nieprzewidywalne.
        const code = crypto.randomInt(100000, 1000000).toString();
        
        // Kod ważny 15 minut
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 15);

        // Zapisz w bazie (hashowanie kodu w bazie to kolejny krok security, ale na start crypto wystarczy)
        await prisma.user.update({
            where: { id: user.id },
            data: { resetCode: code, resetCodeExpiry: expiry }
        });

        // Wyślij maila
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb;">Odzyskiwanie Hasła</h2>
                <p>Otrzymaliśmy prośbę o reset hasła. Twój bezpieczny kod weryfikacyjny to:</p>
                <h1 style="background: #f1f5f9; padding: 10px; letter-spacing: 5px; font-size: 32px; display: inline-block; border-radius: 8px;">${code}</h1>
                <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Kod jest ważny przez 15 minut. Nikomu go nie udostępniaj.</p>
            </div>
        `;

        await transporter.sendMail({
            from: '"TeamGuard Security" <noreply@teamguard.com>',
            to: user.email,
            subject: '🔐 Twój kod do resetu hasła',
            html: htmlContent
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Forgot pass error:", error);
        res.status(500).json({ error: 'Błąd wysyłania kodu.' });
    }
});

// Krok 2: Ustaw nowe hasło (Wymaga kodu)
app.post('/api/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user || user.resetCode !== code) {
            return res.status(400).json({ error: 'Nieprawidłowy kod weryfikacyjny.' });
        }

        if (!user.resetCodeExpiry || new Date() > user.resetCodeExpiry) {
            return res.status(400).json({ error: 'Kod wygasł. Poproś o nowy.' });
        }

        // Walidacja siły hasła (Backendowa tarcza)
        const hasNumber = /\d/.test(newPassword);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
        if (newPassword.length < 8 || !hasNumber || !hasSpecial) {
            return res.status(400).json({ error: 'Hasło za słabe (min. 8 znaków, cyfra, znak specjalny).' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Zapisz hasło i wyczyść kod
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword, resetCode: null, resetCodeExpiry: null }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Błąd resetowania hasła.' });
    }
});

// --- GET: Pobierz historię zmian (Logi) ---
app.get('/api/logs', async (req, res) => {
  try {
    // Pobieramy 100 ostatnich akcji, najnowsze na górze
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania logów' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`--------------------------------------------------`);
  console.log(`🚀 SERWER API DZIAŁA NA PORTCIE ${PORT}`);
  console.log(`--------------------------------------------------`);
});