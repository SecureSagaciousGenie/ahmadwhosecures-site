---
title: Building a Windows hardening tool that can always be undone
description: "Design notes from Win11-Security-Optimizer: read-only scans, before-state backups, a rollback script that standard users cannot tamper with, risk tiers and opt-in DFIR tools checked against pinned hashes."
date: 2026-10-12
order: 5
topics:
  - PowerShell
  - Windows 11
  - Hardening
  - Open source
---

Most Windows hardening scripts are written for administrators who can read them. They change dozens of settings in one run, keep no record of what was there before and run elevated. When something breaks, nobody can tell which change caused it, so the usual fix is to undo all of it. [Win11-Security-Optimizer](https://github.com/SecureSagaciousGenie/Win11-Security-Optimizer) is my attempt at the opposite: a tool a non-expert can run safely, where every change can be traced and reversed.

## Read-only by default

Every scan only reads. Nothing changes until the user ticks an item and confirms a dialog. Scanning and the compromise check work without admin rights. `Start.bat` asks for elevation when it starts, because most people go on to apply fixes. Someone who only wants to know whether their PC is in a good state can start the tool from a normal PowerShell window instead and never hand it admin rights:

```text
powershell -NoProfile -ExecutionPolicy Bypass -STA -File .\src\Optimizer.ps1
```

## Record before you change

System Restore is the obvious safety net, and the tool creates a restore point before the first change in a session. It is not enough on its own. System Restore can be switched off, and by default Windows will not create more than one restore point a day through `Checkpoint-Computer`.

So the tool keeps its own record as well. Before each change it saves the previous value to a JSON backup and appends an undo step to a timestamped rollback script. After each change it reads the setting back to confirm the change took effect, because a fix that silently failed is worse than no fix: the dashboard would show the machine as protected when it is not.

## Protect the undo path

The rollback script is meant to run elevated. That makes its location a security decision. If a standard user, or malware running as one, can edit the rollback script, the next administrator who runs it executes their code.

`%ProgramData%` looks like the right place, but it is not admin-only by default. Standard users can create files and folders there, and they own what they create. The tool's folder needs its own ACL with inheritance removed: Administrators and SYSTEM can write, and Users can read. One way to express that ACL with `icacls` uses the well-known SIDs, so it works whatever language Windows is installed in:

```text
icacls "%ProgramData%\Win11SecurityOptimizer" /inheritance:r /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-545:(OI)(CI)RX"
```

Session logs are different. They are only ever read, never executed, so they live under the user's `%LOCALAPPDATA%`.

## Say what a change costs

Every fix carries a risk tier, so the user sees the impact before applying it.

| Tier: | Examples: | Behaviour: |
|---|---|---|
| Safe | Firewall, Defender toggles, SmartScreen, UAC, AutoRun, Guest account | Applied by Apply Recommended Fixes |
| Elevated | Disable SMBv1, disable LLMNR, ASR rules, RDP NLA | Applied by Apply Recommended Fixes, listed separately in the confirmation |
| High-risk | Memory Integrity, disabling RDP | Hidden unless the user opts in |
| Audit-only | Secure Boot, TPM, BitLocker, Tamper Protection | Reported, never changed by the tool |

*The tiers turn "apply all" into a choice the user can understand, and keep firmware-level settings out of the tool's reach entirely.*

The confirmation for Apply Recommended Fixes groups every pending change by tier. The more disruptive Elevated items are visible as such, rather than buried among low-risk toggles.

## Do not ship what you cannot vouch for

The tool starts from `Start.bat` on the PowerShell 5.1 that ships with Windows. An unsigned `.exe` downloaded from the internet gets flagged by SmartScreen and often quarantined. A batch file that launches readable PowerShell does not, and the user can read every line.

KAPE and THOR are proprietary, so they cannot be redistributed. Hayabusa and Chainsaw are GPL-3.0. Bundling them would not relicense the tool's own MIT code, but it would attach GPL obligations to every release, and the bundled copies would go stale. So the Investigate tab's Deep Scan is native code, and the external tools are an opt-in Pro Tools feature:

1. A consent screen shows the tool, its author, its licence, the official source and the download size.
2. On acceptance, the tool downloads the architecture-matched build from the project's official GitHub release.
3. The archive is checked against a trusted SHA-256: a pinned, reviewed hash for known versions, or GitHub's published digest for a newer release. If no trusted hash is available, the download is refused.
4. The binary is extracted to an admin-locked folder, smoke-tested and run read-only against the event logs.

## Plain English for non-experts

The Investigate tab is written for people who do not know what a Run key is. Each finding says what was found, why it matters and what to do. Deep Scan tags each result `[ALERT]` for high-confidence matches or `[REVIEW]` for patterns that legitimate software also produces. The guidance throughout is to investigate before deleting.

## Testing without clicking

A headless self-test builds and renders the window, runs every read-only engine, prints `SELFTEST_OK` and closes. It catches a broken engine or a GUI that fails to render without anyone clicking through six tabs.

```text
powershell -NoProfile -ExecutionPolicy Bypass -STA -File .\src\Optimizer.ps1 -SelfTest
```

Contributions are welcome on [GitHub](https://github.com/SecureSagaciousGenie/Win11-Security-Optimizer), particularly debloat catalog entries, extra DFIR checks and further hardening items. The rules for any contribution are the ones above: read-only by default; every change backed up and reversible; plain-English explanations.
