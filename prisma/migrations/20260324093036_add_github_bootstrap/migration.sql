-- CreateTable
CREATE TABLE "GitHubBootstrap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "idea" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "localPath" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "stepStatus" TEXT NOT NULL DEFAULT 'GENERATING',
    "stepError" TEXT,
    "description" TEXT,
    "repoUrl" TEXT,
    "repoFullName" TEXT,
    "clonedPath" TEXT,
    "readmeContent" TEXT,
    "changelogContent" TEXT,
    "tasksContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GitHubBootstrap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GitHubBootstrap_userId_idx" ON "GitHubBootstrap"("userId");
