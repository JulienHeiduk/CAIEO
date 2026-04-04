-- CreateTable
CREATE TABLE "RepoSession" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepoSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepoTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "estimate" TEXT,
    "affectedFiles" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionLog" TEXT,
    "diff" TEXT,
    "commitHash" TEXT,
    "userNote" TEXT,
    "editedTitle" TEXT,
    "editedDescription" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepoTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RepoSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RepoSession_userId_idx" ON "RepoSession"("userId");

-- CreateIndex
CREATE INDEX "RepoTask_sessionId_idx" ON "RepoTask"("sessionId");
