-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT,
    "inputUrl" TEXT,
    "resultUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiHistory" ("createdAt", "id", "prompt", "resultUrl", "type", "userId") SELECT "createdAt", "id", "prompt", "resultUrl", "type", "userId" FROM "AiHistory";
DROP TABLE "AiHistory";
ALTER TABLE "new_AiHistory" RENAME TO "AiHistory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
