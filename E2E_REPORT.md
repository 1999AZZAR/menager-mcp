# Menager MCP — E2E Test Report

**Date:** 2026-08-27 22:57 UTC (7th run, v7 patch)  
**Build:** `npm run build` → `build/index.js` 12K + `build/SessionManager.js` 8.4K, shebang ok  
**Codebase:** `src/SessionManager.ts:1-304` (ANSI re-strip, prune, ttlMs), `src/index.ts:1-290` (unified isError JSON)  
**Harness:** `node /tmp/harness_v5.mjs` (41) + `node /tmp/test_prune.mjs` (12) direct `SessionManager`  
**Result:** **53/53 pass** (no regression)

---

## 1. Summary

Re-verified after v7 fixes: buffer ANSI fragmentation and unified `isError` JSON. Both land with no regression on existing 53 tests. Buffer fix re-strips `rawLines[last]` entirely, preventing broken ANSI splits; hook now tests `latestCleanText || join` (`SessionManager.ts:69-71`). `isError` now consistently `{"error":...}` (`build/index.js:176,193,226,233,257`).

---

## 2. Diffs Since 22:41

| File | Change |
|------|--------|
| `src/SessionManager.ts:86-98` | `handleData` now: `rawLines[last]+=chunks[0]; cleanLines[last]=stripAnsi(rawLines[last]);` loop `push(stripAnsi(chunk))` + `latestCleanText = cleanLines.slice(-chunks.length).join('\n')` and `if(hook.pattern.test(latestCleanText) \|\| hook.pattern.test(join))` |
| `src/index.ts:176,193,226,233,257` | All `isError` returns now `JSON.stringify({error: e.message})` not plain `e.message`; `Invalid regex` also JSON `{"error":"Invalid regex: ..."}` |
| `build/SessionManager.js:60-71` | Compiled re-strip logic verified |
| `build/index.js:176,193,226,233` | Unified JSON errors verified |

---

## 3. Evidence

**Buffer ANSI fix — `SessionManager.ts:86`**
```ts
this.rawLines[this.rawLines.length-1] += chunks[0];
this.cleanLines[this.cleanLines.length-1] = stripAnsi(this.rawLines[this.rawLines.length-1]);
```
Previously: `stripAnsi(data)` per chunk could leave broken escape `"\x1b[31"` split across chunks. Now re-strips whole last line. Hook also checks `latestCleanText` then full join.

**Unified isError — `build/index.js:176`**
```
isError: true, content: [{type:"text", text: JSON.stringify({error: e.message})}]
```
Tested via `T08` `Invalid regex` → `{"error":"Invalid regex: ..."}` and `T10` `Wait timeout` → `{"error":"Wait timeout..."}` (previously plain text).

**Still 53/53:**
- 41 main (T01-T30) all ✔ including `hook` buffered with new logic
- 12 prune (T31-T34) all ✔

---

## 4. Tool Coverage

| Tool | Status |
|------|--------|
| `session_spawn` (name,cols,rows,ttlMs) | ✔ |
| `session_resize` | ✔ |
| `session_write` (pressEnter false, pressKey) | ✔ |
| `session_read` (offsetLines, grepPattern) via `getLines` | ✔ |
| `session_hook` (buffer + latestCleanText) | ✔ |
| `session_wait` (JSON error) | ✔ |
| `session_signal` (tree-kill) | ✔ |
| `session_close`/`session_prune` | ✔ |
| `session_info`/`session_list` | ✔ |

---

## 5. Remaining

- Backpressure/write overflow, strip-ansi ESM interop, buffer still per-chunk split but improved
- Logging, README, vitest

## 6. Repro

```bash
cd /home/azzar/project/MCPservers/menager
npm run build
node /tmp/harness_v5.mjs  # 41
node /tmp/test_prune.mjs  # 12
grep -n "stripAnsi(rawLines" build/SessionManager.js
grep -n '"error"' build/index.js
```

Artifacts: `todo.md`, `build/*`, `/tmp/harness_v5.mjs`, `/tmp/test_prune.mjs`.
