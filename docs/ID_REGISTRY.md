# ID Registry

Single source of truth for the next available ID in each artefact sequence. Update this file **immediately** after assigning any new ID — before writing the artefact content.

Rules:
- Always consult this file before creating any new artefact.
- IDs are permanent. Retired or deleted artefacts retain their ID — mark them `Status: Retired`, never delete.
- Use zero-padded 4-digit format: `EPIC-0001`, not `EPIC-1`.

| Sequence | Next Available ID | Last Assigned |
|----------|-------------------|---------------|
| EPIC     | EPIC-0011         | EPIC-0010     |
| US       | US-0038           | US-0037       |
| TASK     | TASK-0014         | TASK-0013     |
| AC       | AC-0128           | AC-0127       |
| TC       | TC-0065           | TC-0064       |
| BUG      | BUG-0004          | BUG-0003      |
