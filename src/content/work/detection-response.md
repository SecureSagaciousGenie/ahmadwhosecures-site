---
title: A SIEM and DFIR stack for a team of one
claim: Designed an on-prem SIEM and DFIR stack that one engineer can run, on servers the business already owned.
evidence: Wazuh all-in-one with Sysmon on every Windows endpoint, five event channels, MITRE-mapped custom rules and FIM. TheHive, Cortex and MISP for case handling. KAPE and THOR Lite for triage. A 19-section build manual covers the stack end to end.
status: In progress
statusNote: Build manual and OS companion complete. Production build under way.
frameworks:
  - Wazuh
  - Sysmon
  - TheHive, Cortex, MISP
  - KAPE, THOR Lite
  - NIST SP 800-171 families 3.3 and 3.6
setting: US defense contractor
period: "2026"
order: 3
related:
  - wazuh-all-in-one-on-ubuntu-24-04
  - kape-and-thor-lite-triage
---

## Setting

About 80 Windows endpoints, no domain controller, an RMM agent already on every device and two rack servers with no assigned role. There was no central logging. The audit and accountability family (3.3) and incident response family (3.6) of NIST SP 800-171 both need a log source, a review process and a way to handle an incident from first alert to closed case.

## Design

The budget answer was open-source tooling on owned hardware. The design question was how to split two servers.

The first draft put the SIEM on the server with less memory. That was the wrong way round. The Wazuh indexer is a JVM process that wants a large heap and a large page cache, all the time. The DFIR stack is bursty: heavy during an investigation, close to idle otherwise. So the SIEM went on the server with more RAM, and the case management and analysis tools went on the other, paired with a dedicated laptop as the hands-on triage workstation.

| Server: | Role: | Load profile: |
|---|---|---|
| Higher-RAM server | Wazuh manager, indexer and dashboard | Sustained memory pressure |
| Second server | TheHive, Cortex, MISP, SIFT | Bursty, investigation-driven |
| Triage laptop | KAPE collection, THOR Lite, parsing | Hands-on, offline-capable |

*The split follows load shape, not tool count.*

## Detection content

- Sysmon deployed fleet-wide through the RMM, using the SwiftOnSecurity configuration for a lower-noise start.
- Five Windows channels collected: Sysmon, Security, System, PowerShell Operational and Defender.
- PowerShell script block logging enabled, since it is off by default.
- Custom rules in the local range for unapproved remote-access tools, unlicensed software indicators, credential dumping, encoded PowerShell, new service installation and hosts-file changes, each mapped to MITRE ATT&CK.
- File integrity monitoring on critical paths and registry Run keys.

## Build discipline

Everything is written down before it is built. The Wazuh manual has 19 sections plus appendices: media preparation, OS install, hardening, the assisted Wazuh install, agent rollout through RMM, rules, retention, backups, daily checks and troubleshooting. A separate OS companion covers Ubuntu 24.04 on the server hardware: firmware settings, RAID choice, LVM layout, disk encryption trade-offs, SSH and firewall hardening, auditd and FIPS. The [condensed version is here](/writing/wazuh-all-in-one-on-ubuntu-24-04/).

## Next phase

Network device syslog, network intrusion detection, IOC lists, active response and cloud identity and mail logs once the MS 365 cutover settles. Each is ordered by value per hour of a single engineer's time.

## Where it stands

The build manual and OS companion are complete. The production build is under way on the server hardware. The DFIR workflow is in use on lab data and described in the [KAPE and THOR Lite write-up](/writing/kape-and-thor-lite-triage/).
