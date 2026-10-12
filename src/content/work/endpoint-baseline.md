---
title: Fleet clean-up and a tiered access baseline
claim: Brought an unmanaged Windows fleet under control through RMM scripting, then designed tiered access so each group gets only what its work needs.
evidence: Fleet-wide PowerShell remediation through Action1 removed unapproved remote-access tools and software, audited local admin sprawl and collected Windows 11 readiness and Autopilot data. Conditional Access tiers set by role, location and device.
status: In progress
statusNote: Fleet remediation complete. Access tiers moving from report-only to enforced.
frameworks:
  - Action1 RMM
  - PowerShell
  - Windows Autopilot
  - Entra ID Conditional Access
  - Intune
  - CMMC Level 1
setting: US defense contractor
period: "2026"
order: 4
related:
  - aadsts50079-security-defaults-to-conditional-access
---

## Setting

Workgroup Windows laptops with no domain and no device management beyond an RMM agent. Users had local admin rights and software was installed by whoever needed it. Access to mail and files did not depend on who you were, where you were or what device you used.

## Audit before change

Every remediation started as a read-only script. The audit pass collected local administrators, installed software, remote-access tools, Windows edition, TPM and Secure Boot state plus Windows 11 readiness. Only after the numbers were reviewed did the remediation scripts run.

The local admin audit gave the root cause for privilege drift. On workgroup machines there is no central authority to take admin rights back, so every fix decays. That finding fed directly into the decision to move devices into Entra ID and Intune rather than keep cleaning by script.

## Remediation through RMM

The remediation scripts are versioned, log every action and are safe to re-run.

- Unapproved remote-access tools, consumer VPNs and unapproved browsers removed fleet-wide.
- Devices renamed to a standard convention through WMI, which avoided domain-join complications on workgroup machines.
- Windows 11 readiness triaged into ready, pending and blocked, with the blocking reason recorded: Home edition, unsupported CPU, missing TPM or Secure Boot off.
- Autopilot hardware hashes collected through the RMM and packaged into chunked import files.
- A LAPS-equivalent for workgroup devices designed around a password manager's service account API, so no local admin password is shared or reused.

## Tiered access

Access is now a function of role, location and device. Office-based staff are bound to the office network. Finance and procurement get the tightest controls. Mobile access is tiered from full apps, to apps with no uploads, to mail only, to none. Personal webmail and consumer MS accounts are blocked at the tenant.

Location rules fit people who stay put. For staff who travel through transit hubs, a country list causes lockouts at the worst moment, so their access rests on a compliant device, MFA and sign-in risk instead.

New location rules run in report-only first, so the sign-in logs show who a rule would block before it blocks anyone.

## Where it stands

Fleet remediation is complete. Devices are moving into Entra ID and Intune through the rebuild rotation. Access tiers are moving from report-only to enforced as each group's devices are rebuilt.
