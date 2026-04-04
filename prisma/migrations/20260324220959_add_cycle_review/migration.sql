-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RepoSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "repoPath" TEXT NOT NULL,
    "repoUrl" TEXT,
    "repoName" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT true,
    "contextSummary" TEXT,
    "contextStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "currentCycle" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reviewContent" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "reviewCycle" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepoSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RepoSession" ("contextStatus", "contextSummary", "createdAt", "currentCycle", "id", "isOwner", "repoName", "repoPath", "repoUrl", "status", "updatedAt", "userId") SELECT "contextStatus", "contextSummary", "createdAt", "currentCycle", "id", "isOwner", "repoName", "repoPath", "repoUrl", "status", "updatedAt", "userId" FROM "RepoSession";
DROP TABLE "RepoSession";
ALTER TABLE "new_RepoSession" RENAME TO "RepoSession";
CREATE INDEX "RepoSession_userId_idx" ON "RepoSession"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
