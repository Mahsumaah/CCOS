# CCOS Live Phase 5 — browser captions (Web Speech)

## Behavior

- **Live captions** use the browser **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`) while CCOS Live is open.
- Final recognition results are batched (periodic flush and on stop) and sent to `POST /api/meetings/[id]/live/transcript` as `TranscriptSegment` rows, scoped by `tenantId`, `meetingId`, and optional `liveSessionId`.

## Product limits

- The API transcribes **the current user’s microphone** in that browser, **not** a full-room mix from LiveKit. Segments are attributed with `speakerUserId` and `speakerName` from the signed-in user.
- Multiple users with transcript permission may each enable captions to enrich the aggregate transcript; workflow (chair/secretary) is described in UI copy under `meetings.liveCaptions`.

## Permissions

- **Unchanged from plan default:** only users with **Finalize minutes** or **Manage meetings** may `POST` transcript segments (same gate as the AI draft assistant). The captions toggle is hidden or blocked for others.

## Live session

- When `liveSessionId` is sent with a batch, the server requires that session to exist for the meeting/tenant and to be in status **LIVE**; otherwise the API returns `live_session_not_active`.

## Browsers

- Best support on Chromium (Chrome, Edge). Safari and others may lack speech recognition; the UI shows an unsupported state when the API is missing.

## Audit

- Successful transcript batch ingest: `TRANSCRIPT_SEGMENTS_INGESTED`.
- Successful AI draft generation: `LIVE_AI_DRAFT_GENERATED`.

## AI draft

- `POST /api/meetings/[id]/live/ai/draft-minutes` is rate-limited (per tenant + user, in-memory) to protect API keys; clients should handle HTTP 429 with `error: "rate_limited"`.
