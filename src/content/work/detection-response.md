---
title: A SIEM and DFIR stack a small team can run
claim: Designing an on-prem SIEM and DFIR stack that one engineer can operate, on hardware the business already owns.
evidence: Wazuh with Sysmon on Windows endpoints, the core event channels, MITRE-mapped custom rules and file integrity monitoring. TheHive, Cortex and MISP for case handling; KAPE and THOR Lite for triage. Everything is written down in a build manual before it is built.
kind: Detection and response
frameworks:
  - Wazuh
  - Sysmon
  - TheHive, Cortex, MISP
  - KAPE, THOR Lite
  - NIST SP 800-171 families 3.3 and 3.6
setting: Defense sector
order: 3
related:
  - wazuh-all-in-one-on-ubuntu-24-04
  - kape-and-thor-lite-triage
---

## The problem

The audit and accountability family (3.3) and the incident response family (3.6) of NIST SP 800-171 both need a log source, a review process and a way to handle an incident from first alert to closed case. A small business that starts without central logging needs all three without a SOC budget.

## Design

The budget answer is open-source tooling on owned hardware. The design question is how to split it across hosts.

The Wazuh indexer is a JVM process that wants a large heap and a large page cache, all the time. The DFIR stack is bursty: heavy during an investigation, close to idle otherwise. So the SIEM goes on the host with more memory, and the case management and analysis tools go on another, paired with a dedicated laptop as the hands-on triage workstation.

| Host: | Role: | Load profile: |
|---|---|---|
| Host with more memory | Wazuh manager, indexer and dashboard | Sustained memory pressure |
| Second host | TheHive, Cortex, MISP, SIFT | Bursty, investigation-driven |
| Triage laptop | KAPE collection, THOR Lite, parsing | Hands-on, offline-capable |

*The split follows load shape, not tool count.*

## Detection content

- Sysmon deployed through the RMM, starting from the SwiftOnSecurity configuration for a lower-noise start.
- Five Windows channels collected: Sysmon, Security, System, PowerShell Operational and Defender.
- PowerShell script block logging enabled, since it is off by default.
- Custom rules in the local range for unapproved remote-access tools, unlicensed software indicators, credential dumping, encoded PowerShell, new service installation and hosts-file changes, each mapped to MITRE ATT&CK.
- File integrity monitoring on critical paths and registry Run keys.

## Build discipline

Everything is written down before it is built. The manual covers media preparation, OS install and hardening, the assisted Wazuh install, agent rollout through the RMM, rules, retention, backups, daily checks and troubleshooting, with a separate OS companion for the server build. The [condensed version is here](/writing/wazuh-all-in-one-on-ubuntu-24-04/), and the DFIR workflow, practised on lab data, is in the [KAPE and THOR Lite write-up](/writing/kape-and-thor-lite-triage/).
