# Discord proposal for pi-mono contribution (issue #1533)

Post this in the pi-mono Discord: https://discord.com/invite/nKXTsAcmbT
Target channel: #contributions or #general (wherever contributors post)

---

Hey, I want to fix issue #1533 — the unrecoverable session crash when an
OpenAI-compatible proxy returns `finish_reason: "error"`.

The bug is in `mapStopReason()` in `openai-completions.ts`. Right now the
default branch does:

```ts
default: {
  const _exhaustive: never = reason;
  throw new Error(`Unhandled stop reason: ${_exhaustive}`);
}
```

So any out-of-spec value from a proxy kills the session. GitHub Copilot,
LiteLLM, and other proxies do send `"error"` on rate limits / upstream
failures — and users get a crash instead of a graceful error.

My fix (2 hunks, 1 file):
1. Widen the parameter type from `ChatCompletionChunk.Choice["finish_reason"]`
   to `string | null` — removes the unused import too
2. Add `case "error": return "error"` and change `default` from throw to
   `return "error"` — matching the exact pattern already used in
   `google-shared.ts mapStopReasonString()`

Branch is ready on my fork: `arosstale/pi-mono`, branch
`fix/1533-map-stop-reason-error`.

Happy to add a test if that's preferred before PR. Just need to be added
to APPROVED_CONTRIBUTORS to open the PR. Thanks!

---

Notes:
- Keep it short, one screen, own voice (not AI-sounding)
- Paste the branch link so Mario can see the exact diff
- Don't explain the obvious — Mario knows the codebase
- Don't use "I noticed" / "I'd like to" / "I was wondering"
