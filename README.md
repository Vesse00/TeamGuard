# 🛡️ TeamGuard - HR & Compliance Management System

**TeamGuard** to wyspecjalizowana aplikacja typu **Micro-SaaS** zaprojektowana, aby rozwiązać chaos w zarządzaniu personelem, uprawnieniami i procesem wdrażania pracowników.

W przeciwieństwie do ciężkich systemów ERP, TeamGuard stawia na **szybkość, czytelność i automatyzację**. Głównym celem systemu jest zapewnienie, że żaden pracownik nie pracuje bez ważnych badań, szkoleń BHP czy uprawnień UDT, a proces onboardingu jest ustandaryzowany.

## ✨ Kluczowe Funkcjonalności

### 🦺 Zarządzanie Zgodnością (Compliance)
- **System "Traffic Light":** Wizualne ostrzeganie (Zielony/Żółty/Czerwony) o statusie uprawnień.
- **Monitoring terminów:** Śledzenie ważności szkoleń BHP, badań lekarskich, uprawnień UDT, SEP i praw jazdy.
- **Automatyczne odnawianie:** Szybka aktualizacja dat ważności jednym kliknięciem.

### 🚀 Smart Onboarding
- **Szablony zadań:** Automatyczne przydzielanie zadań (np. "Odbierz laptopa") na podstawie działu pracownika.
- **Pasek postępu:** Wizualizacja stopnia wdrożenia nowego pracownika.
- **Synchronizacja:** Możliwość aktualizacji zadań dla istniejących pracowników przy zmianie procedur.

### ⏱️ Rejestracja Czasu Pracy (RCP) 🔜
- **Wirtualny czytnik:** Prosty widget Start/Stop na dashboardzie.
- **Logi pracy:** Historia wejść i wyjść z podziałem na źródło (Web/Kiosk/RFID - ready).
- **Statusy:** Podgląd na żywo, kto aktualnie pracuje.

### 🏢 Struktura Organizacji
- Zarządzanie wieloma działami.
- Przypisywanie szablonów onboardingu do konkretnych działów.
- Statystyki zatrudnienia i braków w dokumentacji.

## 🛠️ Tech Stack

Projekt zbudowany w oparciu o nowoczesne technologie webowe:

- **Frontend:** React (Vite), TypeScript, Tailwind CSS
- **Backend:** Node.js, Express
- **Baza Danych:** SQLite (dewelopersko) / PostgreSQL (produkcyjnie), Prisma ORM
- **UI/UX:** Lucide Icons, Sonner (Toasts), Recharts

## 📸 Zrzuty Ekranu


## 📦 Instalacja i Uruchomienie

1. Sklonuj repozytorium:
   ```bash
   git clone [https://github.com/twoj-nick/teamguard.git](https://github.com/twoj-nick/teamguard.git)
   ```

2. **Zainstaluj zależności (Backend i Frontend):**
   ```bash
   cd TeamGuard-db && npm install
   cd ../TeamGuard-app && npm install
   ```
3.Skonfiguruj bazę danych: W folderze TeamGuard-db wykonaj:
```bash
cd TeamGuard-db
npx prisma db push
```
3. Uruchom serwery:
   - Backend (Terminal 1):
     ```bash
     cd TeamGuard-db && npm install
     npx tsx server.ts
     ```
   - Frontend (Terminal 2):
     ```bash
     cd TeamGuard-app && npm install
      npm run dev
     ```

###🔜 Plany Rozwoju (Roadmap)
  - [ ] Integracja z fizycznymi czytnikami RFID.
  - [ ] Moduł kalendarza urlopowego z akceptacją wniosków.
  - [ ] Eksport raportów do formatów księgowych (Enova/Optima).


   
