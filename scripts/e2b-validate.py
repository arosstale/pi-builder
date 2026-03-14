"""
E2B validation script — runs pi-builder vitest suite on clean Linux sandbox.
Usage: E2B_API_KEY=... python3 scripts/e2b-validate.py
"""
import os
from e2b_code_interpreter import Sandbox

def run(sandbox, cmd, timeout=120, label=None):
    if label:
        print(f"\n=== {label} ===", flush=True)
    r = sandbox.commands.run(cmd, timeout=timeout)
    out = (r.stdout or "").strip()
    err = (r.stderr or "").strip()
    if out:
        text = out[-1000:] if len(out) > 1000 else out
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)
    if err:
        text = err[-300:]
        print("STDERR:", text.encode("ascii", "replace").decode("ascii"), flush=True)
    return r

print("Starting E2B sandbox...")
sandbox = Sandbox.create(timeout=360)

try:
    run(sandbox,
        "git clone --depth 1 https://github.com/arosstale/pi-builder.git /home/user/pi-builder 2>&1",
        timeout=60, label="Clone")

    run(sandbox,
        "curl -fsSL https://bun.sh/install | bash 2>&1 | tail -5",
        timeout=90, label="Install Bun")

    run(sandbox,
        "cd /home/user/pi-builder && /home/user/.bun/bin/bun install 2>&1 | tail -10",
        timeout=120, label="bun install")

    run(sandbox,
        "cd /home/user/pi-builder && /home/user/.bun/bin/bunx vitest run packages/core 2>&1 | tail -20",
        timeout=180, label="vitest run packages/core")

finally:
    sandbox.kill()
    print("\nSandbox killed.")
