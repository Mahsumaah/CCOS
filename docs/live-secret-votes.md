# CCOS Live — secret votes visibility

- While a live vote is **open** and visibility is **SECRET**, the votes API omits ballot rows for users who are not the **chair** or **secretary** (live roles `CHAIR` and `SECRETARY`).
- **Chair** and **secretary** always receive full ballot detail for moderation and minutes support.
- After the vote is **closed**, the same rule applies to ballot detail: only chair and secretary see individual ballots. Everyone else receives the **aggregate** outcome stored in `resultJson` (counts, weighted totals if applicable, outcome explanation).

This behavior is enforced in `GET /api/meetings/[id]/live/votes` and is documented for administrators configuring LiveKit and board policy.
