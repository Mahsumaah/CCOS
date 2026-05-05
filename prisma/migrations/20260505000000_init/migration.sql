-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BoardRole" AS ENUM ('CHAIR', 'VICE_CHAIR_1', 'VICE_CHAIR_2', 'VICE_CHAIR_3', 'VICE_CHAIR_4', 'MEMBER', 'SECRETARY_GENERAL', 'ASSISTANT_SECRETARY_GENERAL', 'SUPERVISOR', 'MINUTES_CLERK', 'TREASURER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('BOARD', 'EMERGENCY', 'ASSEMBLY', 'EXECUTIVE_COMMITTEE', 'TECHNICAL_COMMITTEE', 'FINANCIAL_COMMITTEE', 'STRATEGIC');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingSchedulingMode" AS ENUM ('INSTANT', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "DelegationScope" AS ENUM ('ATTENDANCE_ONLY', 'ATTENDANCE_AND_VOTING');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('APPROVE', 'REJECT', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuorumRuleMode" AS ENUM ('ABSOLUTE_MAJORITY', 'TWO_THIRDS', 'MIN_PERCENT');

-- CreateEnum
CREATE TYPE "PositionCategory" AS ENUM ('BOARD', 'EXECUTIVE', 'TECHNICAL', 'ADMINISTRATIVE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "passwordSetupToken" TEXT,
    "passwordSetupExpires" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "role" "BoardRole" NOT NULL DEFAULT 'MEMBER',
    "avatar" TEXT,
    "positionCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permCreateMeetings" BOOLEAN NOT NULL DEFAULT false,
    "permEditMeetings" BOOLEAN NOT NULL DEFAULT false,
    "permManageMeetings" BOOLEAN NOT NULL DEFAULT false,
    "permCreateVotes" BOOLEAN NOT NULL DEFAULT false,
    "permCastVotes" BOOLEAN NOT NULL DEFAULT true,
    "permCreateDecisions" BOOLEAN NOT NULL DEFAULT false,
    "permEditDecisions" BOOLEAN NOT NULL DEFAULT false,
    "permFinalizeMinutes" BOOLEAN NOT NULL DEFAULT false,
    "permManagePositions" BOOLEAN NOT NULL DEFAULT false,
    "permManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL DEFAULT 'BOARD',
    "customMeetingType" TEXT,
    "objectives" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "schedulingMode" "MeetingSchedulingMode" NOT NULL DEFAULT 'SCHEDULED',
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "preMeetingInviteSentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "notes" TEXT,

    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttachment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingInvitation" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BoardRole" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "attendanceCheckedInAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "MeetingInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingDelegation" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "scope" "DelegationScope" NOT NULL DEFAULT 'ATTENDANCE_ONLY',
    "authDocUrl" TEXT,
    "authDocName" TEXT,
    "authDocMime" TEXT,
    "authDocSize" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "question" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteBallot" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "castById" TEXT,
    "choice" "VoteChoice" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "textAr" TEXT NOT NULL,
    "textEn" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Minutes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "contentJson" JSONB,
    "contentHtml" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "adoptedDocumentUrl" TEXT,
    "adoptedDocumentMime" TEXT,
    "adoptedDocumentSize" INTEGER,
    "adoptedById" TEXT,
    "adoptedAt" TIMESTAMP(3),
    "attendeesNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "Minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinutesSignature" (
    "id" TEXT NOT NULL,
    "minutesId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signatureImageUrl" TEXT,
    "typedName" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "hash" TEXT,

    CONSTRAINT "MinutesSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTypeQuorumPolicy" (
    "meetingType" "MeetingType" NOT NULL,
    "quorumRequired" BOOLEAN NOT NULL DEFAULT true,
    "ruleMode" "QuorumRuleMode" NOT NULL DEFAULT 'ABSOLUTE_MAJORITY',
    "minAttendancePercent" INTEGER,
    "optionsJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingTypeQuorumPolicy_pkey" PRIMARY KEY ("meetingType")
);

-- CreateTable
CREATE TABLE "OrganizationalPosition" (
    "code" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "category" "PositionCategory" NOT NULL DEFAULT 'BOARD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrganizationalPosition_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BoardUser_passwordSetupToken_key" ON "BoardUser"("passwordSetupToken");

-- CreateIndex
CREATE UNIQUE INDEX "BoardUser_tenantId_email_key" ON "BoardUser"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingInvitation_meetingId_userId_key" ON "MeetingInvitation"("meetingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VoteBallot_voteId_userId_key" ON "VoteBallot"("voteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Minutes_meetingId_key" ON "Minutes"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MinutesSignature_minutesId_userId_key" ON "MinutesSignature"("minutesId", "userId");

-- AddForeignKey
ALTER TABLE "BoardUser" ADD CONSTRAINT "BoardUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardUser" ADD CONSTRAINT "BoardUser_positionCode_fkey" FOREIGN KEY ("positionCode") REFERENCES "OrganizationalPosition"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttachment" ADD CONSTRAINT "MeetingAttachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttachment" ADD CONSTRAINT "MeetingAttachment_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "MeetingAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttachment" ADD CONSTRAINT "MeetingAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingInvitation" ADD CONSTRAINT "MeetingInvitation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingInvitation" ADD CONSTRAINT "MeetingInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDelegation" ADD CONSTRAINT "MeetingDelegation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDelegation" ADD CONSTRAINT "MeetingDelegation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDelegation" ADD CONSTRAINT "MeetingDelegation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "MeetingAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteBallot" ADD CONSTRAINT "VoteBallot_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteBallot" ADD CONSTRAINT "VoteBallot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteBallot" ADD CONSTRAINT "VoteBallot_castById_fkey" FOREIGN KEY ("castById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "MeetingAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinutesSignature" ADD CONSTRAINT "MinutesSignature_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "Minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinutesSignature" ADD CONSTRAINT "MinutesSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardNotification" ADD CONSTRAINT "BoardNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardNotification" ADD CONSTRAINT "BoardNotification_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

