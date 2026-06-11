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

| Date       | Session ID                           | Branch                            | Input Tokens | Output Tokens | Cache Read Tokens | Cost USD |
| ---------- | ------------------------------------ | --------------------------------- | ------------ | ------------- | ----------------- | -------- |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 128361       | 31221         | 5812543           | 2.6933   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 138455       | 33996         | 6732242           | 3.0487   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 138481       | 34156         | 6922152           | 3.1082   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 138481       | 34156         | 6922152           | 3.1082   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 138537       | 34940         | 7112242           | 3.1772   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 138565       | 35926         | 7494528           | 3.3068   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 140877       | 39758         | 8071339           | 3.5459   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 142329       | 46266         | 8267019           | 3.7077   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 142347       | 47720         | 8470517           | 3.7906   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 142367       | 50364         | 8675467           | 3.8918   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 332757       | 54042         | 8675467           | 4.6610   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 332757       | 54042         | 8675467           | 4.6610   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 336701       | 61108         | 9254899           | 4.9556   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 343473       | 65044         | 9553841           | 5.1297   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 344717       | 66608         | 10182604          | 5.3464   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 351648       | 79988         | 10499690          | 5.6682   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 351829       | 80106         | 10612474          | 5.7045   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 470746       | 85764         | 10838684          | 6.3032   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 490117       | 99294         | 13345948          | 7.3309   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 496319       | 100407        | 14294096          | 7.6553   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 920397       | 109428        | 16106044          | 9.9245   |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 920417       | 110538        | 16389856          | 10.0264  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 993972       | 157392        | 18405750          | 11.6098  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 1050857      | 171478        | 21433525          | 12.9427  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                           | 1522244      | 276352        | 35024573          | 20.3607  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | feature/EPIC-0003-frontend-pages  | 1841535      | 390322        | 41976607          | 25.3531  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | feature/EPIC-0003-frontend-pages  | 1850187      | 392630        | 42464643          | 25.5666  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                           | 1881331      | 405858        | 44886943          | 26.6085  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                           | 1881403      | 406650        | 45125261          | 26.6921  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                           | 1882989      | 407076        | 45364435          | 26.7762  |
| 2026-06-08 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | develop                           | 2044613      | 479335        | 49817363          | 29.8020  |
| 2026-06-09 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 2224798      | 484463        | 51299209          | 30.9992  |
| 2026-06-09 | c04337f5-1c3d-46d5-bc12-c4dda92c661f | main                              | 2231931      | 488815        | 52612596          | 31.4852  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 260751       | 10597         | 640243            | 1.3288   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 266357       | 12099         | 766037            | 1.4101   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 292526       | 31223         | 1792942           | 2.1032   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 311290       | 40748         | 3265001           | 2.7578   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 351049       | 59678         | 3791633           | 3.3488   |
| 2026-06-10 | sess_1781061510133                   | develop                           | 0            | 0             | 0                 | 0.0000   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 532203       | 77916         | 9424246           | 5.9914   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 534651       | 85335         | 10074425          | 6.3069   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 538855       | 87903         | 10336903          | 6.4399   |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 820648       | 175039        | 17867161          | 11.0627  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2093896      | 695928        | 63317939          | 37.2850  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2370323      | 696873        | 63594200          | 38.4187  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2373531      | 699422        | 64426766          | 38.7187  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2373663      | 700066        | 64707440          | 38.8131  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2374859      | 700797        | 65411570          | 39.0397  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2591327      | 703828        | 65978219          | 40.0670  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2596132      | 708973        | 66697154          | 40.3778  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2912651      | 713377        | 67219756          | 41.7876  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2941074      | 730257        | 70495905          | 43.1302  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2986869      | 752231        | 77485355          | 45.7283  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2991004      | 756247        | 78829547          | 46.2073  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2995532      | 760875        | 80206568          | 46.7068  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2996202      | 763409        | 80460554          | 46.8235  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 2996315      | 763447        | 80589131          | 46.8631  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 3000431      | 765811        | 82018133          | 47.3426  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 3001505      | 767763        | 82281221          | 47.4549  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 3183767      | 833736        | 98432195          | 53.9731  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 3669943      | 863019        | 105338427         | 58.3073  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 3705904      | 894554        | 108218994         | 59.7794  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 3706702      | 896074        | 108496631         | 59.8884  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | feature/e2e-playwright-full-suite | 3712425      | 899517        | 109919966         | 60.3885  |
| 2026-06-10 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 3715341      | 900306        | 110599986         | 60.6153  |
| 2026-06-11 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 3914582      | 901805        | 110699289         | 61.4147  |
| 2026-06-11 | 5a17c882-3690-41c0-a61b-4afe5aa2ad5a | develop                           | 3914899      | 901999        | 110799220         | 61.4488  |
