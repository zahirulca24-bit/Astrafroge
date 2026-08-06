# Scanner Runtime Persistence

Issue 1 adds durable restart recovery for the bounded Scanner runtime without changing any trading formula, threshold, signal rule, risk policy, or execution setting.

## Persisted state

- Scanner ON/OFF state
- Bounded scanner run history
- Active and terminal candidates
- Candidate evaluation contexts required by refresh and risk-stop calculations
- Terminal candidate tombstones
- Symbol/direction/setup re-entry cooldown history
- Next full-scan and active-refresh timestamps
- Last completed refresh boundary

## Recovery rules

- The snapshot is restored before the scanner service is exposed to API callers.
- `run_active` is always reset to `false`; interrupted work is never treated as completed.
- A recovered ON scanner recreates its scheduler.
- Corrupt or incompatible snapshots fail closed instead of silently clearing deduplication or cooldown protection.
- Runtime state is saved atomically after start, stop, full scan, active refresh, and scheduler-boundary updates.

## Storage model

The bounded runtime is stored as a versioned JSON snapshot in PostgreSQL through Alembic migration `20260806_0004`.

A single atomic snapshot is intentional for this phase because the scanner already enforces bounded candidate, terminal-history, and run-history limits. It prevents partially restored runtime state where candidates, contexts, cooldowns, and scheduler timestamps could disagree.

## Safety boundary

- Binance Demo execution remains disabled.
- Scanner qualification thresholds remain unchanged.
- Early Watch remains non-executable.
- Signal, Risk, Execution, Trade Management, and Journal behavior remain unchanged.
