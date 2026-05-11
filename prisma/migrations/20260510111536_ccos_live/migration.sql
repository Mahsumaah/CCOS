-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('IDLE', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "LiveRecordingStatus" AS ENUM ('NOT_STARTED', 'RECORDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MeetingLiveRole" AS ENUM ('CHAIR', 'VICE_CHAIR', 'SECRETARY', 'DECISION_RECORDER', 'VOTING_MEMBER', 'NON_VOTING_MEMBER', 'OBSERVER', 'GUEST', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "LiveVoteVisibility" AS ENUM ('PUBLIC', 'SECRET');

-- CreateEnum
CREATE TYPE "LiveVoteRule" AS ENUM ('MAJORITY', 'QUORUM_GATED', 'ROLE_WEIGHTED');

-- CreateEnum
CREATE TYPE "LiveVoteChoice" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "LiveDecisionStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'IN_REVIEW');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('RECORDING', 'TRANSCRIPT', 'AI_MINUTES_DRAFT', 'FINAL_MINUTES', 'SIGNED_MINUTES');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LIVE_SESSION_OPENED', 'LIVE_SESSION_CLOSED', 'PARTICIPANT_JOINED', 'PARTICIPANT_LEFT', 'PARTICIPANT_REJOINED', 'PARTICIPANT_RAISED_HAND', 'PARTICIPANT_MUTED', 'PARTICIPANT_REMOVED', 'SCREEN_SHARE_STARTED', 'SCREEN_SHARE_STOPPED', 'LIVE_VOTE_OPENED', 'LIVE_VOTE_CAST', 'LIVE_VOTE_CLOSED', 'LIVE_DECISION_CREATED', 'LIVE_DECISION_UPDATED', 'LIVE_DECISION_APPROVED', 'ARTIFACT_CREATED', 'MINUTES_SIGNED');

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'IDLE',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "endedById" TEXT,
    "recordingStatus" "LiveRecordingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "recordingUrl" TEXT,
    "recordingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveParticipantSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "participantSid" TEXT,
    "role" "MeetingLiveRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "reconnectCount" INTEGER NOT NULL DEFAULT 0,
    "raisedHandAt" TIMESTAMP(3),
    "mutedByChairAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveParticipantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveVote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "agendaItemId" TEXT,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "visibility" "LiveVoteVisibility" NOT NULL DEFAULT 'PUBLIC',
    "rule" "LiveVoteRule" NOT NULL DEFAULT 'MAJORITY',
    "quorumRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowedRoles" JSONB,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveVoteBallot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "liveVoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" "LiveVoteChoice" NOT NULL,
    "isDelegated" BOOLEAN NOT NULL DEFAULT false,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,

    CONSTRAINT "LiveVoteBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveDecisionEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "agendaItemId" TEXT,
    "decisionText" TEXT NOT NULL,
    "status" "LiveDecisionStatus" NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "recordedById" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "requiresVote" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveDecisionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "type" "ArtifactType" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "source" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "speakerName" TEXT,
    "speakerUserId" TEXT,
    "language" TEXT,
    "text" TEXT NOT NULL,
    "startedAtMs" INTEGER,
    "endedAtMs" INTEGER,
    "confidence" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT,
    "liveSessionId" TEXT,
    "liveVoteId" TEXT,
    "liveDecisionEventId" TEXT,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveSession_tenantId_meetingId_createdAt_idx" ON "LiveSession"("tenantId", "meetingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_meetingId_roomName_key" ON "LiveSession"("meetingId", "roomName");

-- CreateIndex
CREATE INDEX "LiveParticipantSession_tenantId_meetingId_joinedAt_idx" ON "LiveParticipantSession"("tenantId", "meetingId", "joinedAt");

-- CreateIndex
CREATE INDEX "LiveParticipantSession_liveSessionId_joinedAt_idx" ON "LiveParticipantSession"("liveSessionId", "joinedAt");

-- CreateIndex
CREATE INDEX "LiveVote_tenantId_meetingId_openedAt_idx" ON "LiveVote"("tenantId", "meetingId", "openedAt");

-- CreateIndex
CREATE INDEX "LiveVote_liveSessionId_openedAt_idx" ON "LiveVote"("liveSessionId", "openedAt");

-- CreateIndex
CREATE INDEX "LiveVoteBallot_tenantId_meetingId_castAt_idx" ON "LiveVoteBallot"("tenantId", "meetingId", "castAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveVoteBallot_liveVoteId_userId_key" ON "LiveVoteBallot"("liveVoteId", "userId");

-- CreateIndex
CREATE INDEX "LiveDecisionEvent_tenantId_meetingId_eventAt_idx" ON "LiveDecisionEvent"("tenantId", "meetingId", "eventAt");

-- CreateIndex
CREATE INDEX "LiveDecisionEvent_liveSessionId_eventAt_idx" ON "LiveDecisionEvent"("liveSessionId", "eventAt");

-- CreateIndex
CREATE INDEX "MeetingArtifact_tenantId_meetingId_createdAt_idx" ON "MeetingArtifact"("tenantId", "meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "TranscriptSegment_tenantId_meetingId_createdAt_idx" ON "TranscriptSegment"("tenantId", "meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_meetingId_createdAt_idx" ON "AuditLog"("tenantId", "meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_createdAt_idx" ON "AuditLog"("tenantId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveParticipantSession" ADD CONSTRAINT "LiveParticipantSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveParticipantSession" ADD CONSTRAINT "LiveParticipantSession_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveParticipantSession" ADD CONSTRAINT "LiveParticipantSession_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveParticipantSession" ADD CONSTRAINT "LiveParticipantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVote" ADD CONSTRAINT "LiveVote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVote" ADD CONSTRAINT "LiveVote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVote" ADD CONSTRAINT "LiveVote_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVote" ADD CONSTRAINT "LiveVote_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "MeetingAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVote" ADD CONSTRAINT "LiveVote_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVote" ADD CONSTRAINT "LiveVote_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVoteBallot" ADD CONSTRAINT "LiveVoteBallot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVoteBallot" ADD CONSTRAINT "LiveVoteBallot_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVoteBallot" ADD CONSTRAINT "LiveVoteBallot_liveVoteId_fkey" FOREIGN KEY ("liveVoteId") REFERENCES "LiveVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVoteBallot" ADD CONSTRAINT "LiveVoteBallot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "MeetingAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "BoardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveDecisionEvent" ADD CONSTRAINT "LiveDecisionEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingArtifact" ADD CONSTRAINT "MeetingArtifact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingArtifact" ADD CONSTRAINT "MeetingArtifact_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingArtifact" ADD CONSTRAINT "MeetingArtifact_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingArtifact" ADD CONSTRAINT "MeetingArtifact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_liveVoteId_fkey" FOREIGN KEY ("liveVoteId") REFERENCES "LiveVote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_liveDecisionEventId_fkey" FOREIGN KEY ("liveDecisionEventId") REFERENCES "LiveDecisionEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "BoardUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
