// UWAGA: Używamy require i __dirname, żeby wymusić ścieżkę obok tego pliku
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Rozpoczynam seedowanie...');

  // 1. Czyścimy bazę
  try {
    await prisma.complianceEvent.deleteMany();
    await prisma.employee.deleteMany();
    console.log('🗑️  Wyczyszczono stare dane.');
  } catch (e) {
    console.log('⚠️  Baza była pusta lub błąd czyszczenia.');
  }

  // 2. Dodajemy Marka
  await prisma.employee.create({
    data: {
      firstName: 'Marek',
      lastName: 'Nowak',
      position: 'Magazynier',
      email: 'marek@firma.pl',
      hiredAt: new Date('2020-01-10'),
      avatarInitials: 'MN',
      compliance: {
        create: [
          {
            type: 'BHP',          // KLUCZOWE
            name: 'Szkolenie BHP',
            expiryDate: new Date('2023-12-01'), // Przeterminowane
            status: 'EXPIRED'
          },
          {
            type: 'MEDICAL',      // KLUCZOWE
            name: 'Badania Lekarskie',
            expiryDate: new Date('2026-05-20'), // Ważne długo
            status: 'VALID'
          }
        ]
      }
    }
  })

  // 3. Dodajemy Annę (BHP kończy się zaraz, Badania wygasły)
  await prisma.employee.create({
    data: {
      firstName: 'Anna',
      lastName: 'Kowalska',
      position: 'Sprzedaż',
      hiredAt: new Date('2022-05-01'),
      avatarInitials: 'AK',
      compliance: {
        create: [
          {
            type: 'BHP',
            name: 'Szkolenie BHP',
            expiryDate: new Date('2026-02-28'), // Kończy się w tym miesiącu (Ostrzeżenie)
            status: 'WARNING'
          },
          {
            type: 'MEDICAL',
            name: 'Badania Lekarskie',
            expiryDate: new Date('2025-01-15'), // Wygasło
            status: 'EXPIRED'
          }
        ]
      }
    }
  });

  console.log('✅ Baza zasiana danymi! (SUKCES)');
}

main()
  .catch((e) => {
    console.error('❌ BŁĄD:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });