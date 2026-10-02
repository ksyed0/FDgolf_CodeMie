# ID Registry

Single source of truth for the next available ID in each artefact sequence. Update this file **immediately** after assigning any new ID — before writing the artefact content.

Rules:
- Always consult this file before creating any new artefact.
- IDs are permanent. Retired or deleted artefacts retain their ID — mark them `Status: Retired`, never delete.
- Use zero-padded 4-digit format: `EPIC-0001`, not `EPIC-1`.

| Sequence | Next Available ID | Last Assigned |
|----------|-------------------|---------------|
| EPIC     | EPIC-0013         | EPIC-0012     |
| US       | US-0048           | US-0047       |
| TASK     | TASK-0047         | TASK-0046     |
| AC       | AC-0155           | AC-0154       |
| TC       | TC-0171           | TC-0170       |
| BUG      | BUG-0018          | BUG-0017      |

> Note (2026-09-30): BUG-0015 was already consumed by a merged fix (commit `f000ad3`,
> "Scope player tournament lookup to membership, not latest row") whose `docs/BUGS.md`
> write-up was never committed — the registry had stalled at "Next Available: BUG-0015"
> even though that ID was spent. Corrected here; BUG-0016 is the next real ID and was
> assigned to the new entry below it in this session. The missing BUG-0015 write-up is
> a separate pre-existing gap, not addressed here.
