# Docs Index

## Root-Level Docs

| File | Purpose |
|------|---------|
| [README.md](../README.md) | What this repo is, how to run it |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System design: API proxy, realtime, stores, hooks, auth, security |
| [DESIGN.md](../DESIGN.md) | Design principles, component patterns, naming conventions |
| [ROADMAP.md](../ROADMAP.md) | Product phases and exit criteria |
| [CLAUDE.md](../CLAUDE.md) | Developer onboarding: code style, rules, conventions |

## Technical Reference

| File | Purpose |
|------|---------|
| [client-logic.md](client-logic.md) | 37 client-side patterns: score reveal, cache, analytics, etc. |
| [state-management.md](state-management.md) | Zustand stores in depth: shape, persistence, preference sync |
| [realtime.md](realtime.md) | Realtime transport: WebSocket/SSE failover, subscriptions, sequence tracking |
| [env-and-config.md](env-and-config.md) | Environment variables and `src/lib/config.ts` constants |

## Development

| File | Purpose |
|------|---------|
| [development.md](development.md) | Local setup, QA checklist, common issues |
| [testing.md](testing.md) | Playwright E2E: helpers, test suites, resilience patterns |
| [deployment.md](deployment.md) | Docker build, CI/CD pipeline, Hetzner deploy |

## Audits

| File | Purpose |
|------|---------|
| [audits/abend-handling.md](audits/abend-handling.md) | Error handling audit (2026-04-18): 9 issues found, 8 fixed |
| [audits/security-audit.md](audits/security-audit.md) | Security review (2026-04-18): open redirect, token exposure, JWT storage |
| [audits/ssot-cleanup.md](audits/ssot-cleanup.md) | SSOT cleanup (2026-04-18): 5 dead code paths removed |
| [audits/docs-consolidation.md](audits/docs-consolidation.md) | Docs consolidation (2026-04-18): what changed and why |

## Archived

Historical research and external audit notes that informed product decisions but are not current technical references.

| File | Purpose |
|------|---------|
| [archived/braindump.md](archived/braindump.md) | External audit notes on product focus and UX critique |
| [archived/research/](archived/research/) | 13 research docs: APIs, UX patterns, monetization, PWA, etc. |
