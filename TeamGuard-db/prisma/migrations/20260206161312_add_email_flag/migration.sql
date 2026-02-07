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
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reportDay" TEXT NOT NULL DEFAULT 'MONDAY',
    "reportTime" TEXT NOT NULL DEFAULT '09:00'
);
INSERT INTO "new_User" ("createdAt", "email", "firstName", "id", "lastName", "password", "reportDay", "reportEnabled", "reportTime") SELECT "createdAt", "email", "firstName", "id", "lastName", "password", "reportDay", "reportEnabled", "reportTime" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
