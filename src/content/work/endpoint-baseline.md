---
title: Endpoint baseline and tiered access
claim: Bringing unmanaged Windows laptops under control through RMM scripting, then tying access to role, location and device.
evidence: Read-only audits before any change, versioned remediation scripts through Action1, Windows 11 readiness and Autopilot data collected through the RMM, and Conditional Access tiers that run in report-only before they enforce.
kind: Endpoint and identity
frameworks:
  - Action1 RMM
  - PowerShell
  - Windows Autopilot
  - Entra ID Conditional Access
  - Intune
setting: Defense sector
order: 4
related:
  - aadsts50079-security-defaults-to-conditional-access
---

## The problem

A common small-business starting point: Windows laptops in a workgroup, local admin rights for users, software installed by whoever needs it, and access to mail and files that does not depend on who you are, where you are or what device you use.

## Audit before change

Every remediation starts as a read-only script. The audit pass collects local administrators, installed software, remote-access tools, Windows edition, TPM and Secure Boot state, and Windows 11 readiness. Only after the numbers are reviewed do the remediation scripts run.

A local admin audit usually shows the root cause of privilege drift. On workgroup machines there is no central authority to take admin rights back, so every fix decays. That is the argument for moving devices into Entra ID and Intune rather than cleaning by script indefinitely.

## Remediation through RMM

The remediation scripts are versioned, log every action and are safe to re-run. They:

- remove unapproved remote-access tools, consumer VPNs and unapproved browsers
- rename devices to a standard convention through WMI, which avoids domain-join complications on workgroup machines
- triage Windows 11 readiness into ready, pending and blocked, recording the blocking reason: Home edition, unsupported CPU, missing TPM or Secure Boot off
- collect Autopilot hardware hashes and package them into chunked import files
- run a LAPS-equivalent for workgroup devices, built around a password manager's service account API, so no local admin password is shared or reused

## Tiered access

Access becomes a function of role, location and device. The more sensitive the role, the tighter the device and location rules, and mobile access is granted by role rather than to everyone. Consumer webmail and consumer MS accounts can be blocked at the tenant.

Location rules fit people who stay put. For staff who travel, a country list causes lockouts at the worst moment, so their access rests on a compliant device, MFA and sign-in risk instead.

New location rules run in report-only first, so the sign-in logs show who a rule would block before it blocks anyone. The [sign-in panel on the home page](/#sim-title) shows how a set of policies combines on a single sign-in.
