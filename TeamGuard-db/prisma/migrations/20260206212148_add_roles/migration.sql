-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reportDay" TEXT NOT NULL DEFAULT 'MONDAY',
    "reportTime" TEXT NOT NULL DEFAULT '09:00',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDays" TEXT NOT NULL DEFAULT 'MONDAY,WEDNESDAY,FRIDAY',
    "emailTime" TEXT NOT NULL DEFAULT '08:00',
    "resetCode" TEXT,
    "resetCodeExpiry" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "inviteToken" TEXT
);
INSERT INTO "new_User" ("createdAt", "email", "emailDays", "emailEnabled", "emailTime", "firstName", "id", "lastName", "password", "reportDay", "reportEnabled", "reportTime", "resetCode", "resetCodeExpiry") SELECT "createdAt", "email", "emailDays", "emailEnabled", "emailTime", "firstName", "id", "lastName", "password", "reportDay", "reportEnabled", "reportTime", "resetCode", "resetCodeExpiry" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
