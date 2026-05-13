# Docs Index

## Architecture & Design

| File | Purpose |
|------|---------|
| [architecture.md](architecture.md) | API proxy routes, catch-up pipeline (selection → rhythm planning → render), stores, hooks, security headers |
| [design.md](design.md) | Product principles and component patterns aligned to the broadcast-machine identity in [`../BRAINDUMP.md`](../../BRAINDUMP.md) |

## Technical Reference

| File | Purpose |
|------|---------|
| [state-management.md](state-management.md) | The three Zustand stores: `settings`, `onboarding`, `catchup-progress` |
| [env-and-config.md](env-and-config.md) | Environment variables and `web/src/lib/config.ts` constants |

## Development

| File | Purpose |
|------|---------|
| [development.md](development.md) | Local setup, commands, common issues, manual QA checklist |
| [testing.md](testing.md) | Vitest unit suite layout + Playwright E2E configuration; npm scripts |
| [deployment.md](deployment.md) | Docker build, CI/CD pipeline, Hetzner deploy |
| [PROD_PROMOTION_AND_COM_SETUP.md](PROD_PROMOTION_AND_COM_SETUP.md) | `.com` vs `.dev` domain wiring; Cloudflare and promote-prod runbook |

## Customer-voice / Roadmap

| File | Purpose |
|------|---------|
| [`../../BRAINDUMP.md`](../../BRAINDUMP.md) | Customer-voice product brief (broadcast machine / spatial cohesion phase) — lives at the workspace root, one level above this repo |
| [`../../.aidlc/issues/`](../../.aidlc/issues/) | Granular tracked issues that drive each AIDLC run — also at workspace root |

## Audits (this branch)

Each audit pass acts on its findings in place and justifies anything left as-is.

| File | Purpose |
|------|---------|
| [audits/cleanup-report.md](audits/cleanup-report.md) | Cleanup pass: dead code removed, files >500 LOC justified or planned |
| [audits/error-handling-report.md](audits/error-handling-report.md) | Error-handling audit |
| [audits/security-report.md](audits/security-report.md) | Security audit (proxy, CSP, hardening) |
| [audits/ssot-report.md](audits/ssot-report.md) | SSOT enforcement (catch-up pipeline, geometry constants) |
| [audits/docs-consolidation.md](audits/docs-consolidation.md) | This pass: rewrites, deletions, statements removed as unverifiable |

## Archived

| File | Purpose |
|------|---------|
| [aidlc-futures.md](aidlc-futures.md) | Last AIDLC run summary (auto-generated; superseded each run) |
