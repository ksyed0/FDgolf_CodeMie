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
| TC       | TC-0130           | TC-0129       |
| BUG      | BUG-0008          | BUG-0007      |
