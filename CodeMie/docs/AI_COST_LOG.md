# AI Cost Log

Append-only ledger of AI session costs. Never edit or delete rows.
Updated automatically by the Claude Code stop hook (`tools/capture-cost.js`).

Rows marked `[est]` are manually estimated for sessions that predate the capture-cost hook.
Pricing basis: Claude Sonnet 4.6 — Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok

---

## Keeping Costs Accurate

**If the AI Cost column in the dashboard is blank or zero for a story**, it means no cost log row has a `Branch` value matching that story's `Branch:` field exactly. Two common causes:

1. **Sessions predating the capture-cost hook** — add estimated rows manually using the `-est` suffix convention (e.g. `sess_NNNN-est`).
2. **Branch name mismatch** — the branch in the cost log row must exactly match the `Branch:` field in RELEASE_PLAN.md (case-sensitive).

**To estimate and backfill costs**, ask your AI assistant:

> "Look at `docs/AI_COST_LOG.md` and `docs/RELEASE_PLAN.md`. For any story whose branch has no matching cost log row, estimate the token usage based on the work described and the t-shirt size, then append new `[est]` rows. Use Claude Sonnet 4.6 pricing: Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok."

**Human cost** is computed automatically from t-shirt size × hourly rate in `plan-visualizer.config.json`. To update the hourly rate, change `costs.hourlyRate` in the config.

---

| Date       | Session ID                           | Branch                           | Input Tokens | Output Tokens | Cache Read Tokens | Cost USD |
| ---------- | ------------------------------------ | -------------------------------- | ------------ | ------------- | ----------------- | -------- |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 128361       | 31221         | 5812543           | 2.6933   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 138455       | 33996         | 6732242           | 3.0487   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 138481       | 34156         | 6922152           | 3.1082   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 138481       | 34156         | 6922152           | 3.1082   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 138537       | 34940         | 7112242           | 3.1772   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 138565       | 35926         | 7494528           | 3.3068   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 140877       | 39758         | 8071339           | 3.5459   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 142329       | 46266         | 8267019           | 3.7077   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 142347       | 47720         | 8470517           | 3.7906   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 142367       | 50364         | 8675467           | 3.8918   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 332757       | 54042         | 8675467           | 4.6610   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 332757       | 54042         | 8675467           | 4.6610   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 336701       | 61108         | 9254899           | 4.9556   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 343473       | 65044         | 9553841           | 5.1297   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 344717       | 66608         | 10182604          | 5.3464   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 351648       | 79988         | 10499690          | 5.6682   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 351829       | 80106         | 10612474          | 5.7045   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 470746       | 85764         | 10838684          | 6.3032   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 490117       | 99294         | 13345948          | 7.3309   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 496319       | 100407        | 14294096          | 7.6553   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 920397       | 109428        | 16106044          | 9.9245   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 920417       | 110538        | 16389856          | 10.0264  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 993972       | 157392        | 18405750          | 11.6098  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 1050857      | 171478        | 21433525          | 12.9427  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                          | 1522244      | 276352        | 35024573          | 20.3607  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | feature/EPIC-0003-frontend-pages | 1841535      | 390322        | 41976607          | 25.3531  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | feature/EPIC-0003-frontend-pages | 1850187      | 392630        | 42464643          | 25.5666  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                          | 1881331      | 405858        | 44886943          | 26.6085  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                          | 1881403      | 406650        | 45125261          | 26.6921  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                          | 1882989      | 407076        | 45364435          | 26.7762  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                          | 2044613      | 479335        | 49817363          | 29.8020  |
| 2026-06-09 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 2224798      | 484463        | 51299209          | 30.9992  |
| 2026-06-09 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                             | 2231931      | 488815        | 52612596          | 31.4852  |
