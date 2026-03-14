# pi-mono contribution plan

Mario returns Feb 23, 2026. `arosstale` not yet in APPROVED_CONTRIBUTORS.
Two fix branches ready. Post comments on both discussions when Mario is back.

---

## Fix 1 — discussion #1533
https://github.com/badlogic/pi-mono/discussions/1533
Branch: `arosstale/pi-mono@fix/1533-map-stop-reason-error` (commit 9234bde8)

### Comment to post on #1533

Fix is ready on `arosstale/pi-mono@fix/1533-map-stop-reason-error`.

Two changes, one file (`openai-completions.ts`):
- Widen `mapStopReason` param to `string | null` (removes the unused `ChatCompletionChunk` import)
- Add `case "error"` + change `default` from throw to `return "error"` — matches `google-shared.ts mapStopReasonString()`

Need to be added to APPROVED_CONTRIBUTORS to open the PR. Can add a test if needed.

---

## Fix 2 — discussion #1487
https://github.com/badlogic/pi-mono/discussions/1487
Branch: `arosstale/pi-mono@fix/1487-google-cached-tokens-double-count` (commit 2123534b)

### Comment to post on #1487

Fix ready on `arosstale/pi-mono@fix/1487-google-cached-tokens-double-count`.

One line change in `google.ts` — apply the same subtraction already in `google-gemini-cli.ts` (line 660):

```
input: (chunk.usageMetadata.promptTokenCount || 0) - (chunk.usageMetadata.cachedContentTokenCount || 0),
```

Will open PR once approved on #1533.

---

## Notes
- Post #1533 comment first — that gets us approved
- #1487 comment can go same day — once approved we can open both PRs
- Don't open a Contribution Proposal discussion — we're offering to fix existing bugs, not proposing new work
- PR gate: bot adds `arosstale` to APPROVED_CONTRIBUTORS after Mario's `lgtm`
- Both fixes: 1 file each, clean, no deps on each other
