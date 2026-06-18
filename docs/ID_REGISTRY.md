# ID Registry

Single source of truth for the next available ID in each artefact sequence. Update this file **immediately** after assigning any new ID — before writing the artefact content.

Rules:
- Always consult this file before creating any new artefact.
- IDs are permanent. Retired or deleted artefacts retain their ID — mark them `Status: Retired`, never delete.
- Use zero-padded 4-digit format: `EPIC-0001`, not `EPIC-1`.

| Sequence | Next Available ID | Last Assigned |
|----------|-------------------|---------------|
| EPIC     | EPIC-0011         | EPIC-0010     |
| US       | US-0040           | US-0039       |
| TASK     | TASK-0039         | TASK-0038     |
| AC       | AC-0138           | AC-0137       |
| TC       | TC-0082           | TC-0081       |
| BUG      | BUG-0007          | BUG-0006      |
