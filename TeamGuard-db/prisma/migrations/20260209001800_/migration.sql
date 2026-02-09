/*
  Warnings:

  - You are about to drop the `Department` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OnboardingTask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OnboardingTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `departmentId` on the `Employee` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Department_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Department";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OnboardingTask";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OnboardingTemplate";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isSystemAdmin" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'Ogólny',
    "email" TEXT,
    "hiredAt" DATETIME NOT NULL,
    "avatarInitials" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("avatarInitials", "createdAt", "email", "firstName", "hiredAt", "id", "isSystemAdmin", "lastName", "position", "updatedAt", "userId") SELECT "avatarInitials", "createdAt", "email", "firstName", "hiredAt", "id", "isSystemAdmin", "lastName", "position", "updatedAt", "userId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
