---
title: Win11-Security-Optimizer
claim: Wrote and maintain an open-source Windows 11 hardening and triage tool in which every change is backed up and reversible.
evidence: A PowerShell 5.1 GUI with a security audit and tiered fixes, debloat, a plain-English compromise check and a native process and event-log hunt. Restore point, JSON before-state, rollback script and verify-after-apply on every change.
kind: Open source
status: Shipped
statusNote: Public on GitHub under the MIT licence. Under active development.
frameworks:
  - PowerShell 5.1
  - Windows 11
  - MS Defender
  - Hayabusa, Chainsaw (opt-in)
setting: Independent open source
period: 2026 to now
order: 5
related:
  - building-a-reversible-windows-hardening-tool
---

## Why it exists

Most Windows hardening scripts are written for administrators who can read them. Most people who own a Windows 11 PC cannot, and the scripts they find online change dozens of settings at once with no record of what was there before. I wanted a tool a non-expert could run safely, and that I would be comfortable giving to family.

## What it does

A single window with six tabs: a dashboard with a full scan, a security audit with tiered fixes, debloat, a compromise check written for non-experts, startup management and a restore and log view. It runs from `Start.bat` on the PowerShell 5.1 that ships with Windows. There is nothing to install and no unsigned binary for SmartScreen to quarantine.

## The design rules

Scans are read-only. Nothing changes without a tick and a confirmation. Before the first change the tool creates a System Restore point. Every change writes its before-state to a JSON backup, appends an undo step to a rollback script and is re-read afterwards to confirm it applied.

The rollback script runs elevated, so where it lives matters. When the tool runs as administrator it writes backups and the rollback script to a folder under `%ProgramData%` that only Administrators and SYSTEM can write to. A rollback script in a user-writable folder would be a privilege escalation path waiting for a non-admin process to edit it.

Third-party DFIR tools are opt-in and never bundled. Hayabusa and Chainsaw download from their official GitHub releases only after a consent screen, and only if the archive matches a pinned SHA-256. If no trusted hash is available the download is refused.

## Where it stands

Public on [GitHub](https://github.com/SecureSagaciousGenie/Win11-Security-Optimizer) under the MIT licence and under active development. The [design write-up](/writing/building-a-reversible-windows-hardening-tool/) goes deeper on the trade-offs.
