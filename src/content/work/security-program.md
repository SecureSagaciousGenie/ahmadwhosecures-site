---
title: Building a CMMC and NIST SP 800-171 program
claim: How I build a security and compliance program for a small defense contractor. Scope comes first, then controls, then an evidence trail an assessor can follow.
evidence: Scoping that keeps CUI in a small enclave, the CMMC Level 1 practice set on the commercial side, an SSP written against NIST SP 800-171 with the Rev 3 parameters recorded, and an ISO/IEC 27001:2022 ISMS fed by the same evidence.
kind: Compliance program
frameworks:
  - CMMC 2.0 Level 1 and Level 2
  - NIST SP 800-171
  - DFARS 252.204-7012
  - ISO/IEC 27001:2022
setting: Defense sector
order: 1
related:
  - aadsts50079-security-defaults-to-conditional-access
  - wazuh-all-in-one-on-ubuntu-24-04
---

## The problem

Defense primes are pushing CMMC requirements down their supply chains. On my reading of the 48 CFR rule, Phase 2 of the rollout starts on 10 November 2026, and that is when third-party Level 2 assessments begin to appear in new contracts. Primes are already asking for evidence before that date.

A small contractor in that position rarely has budget for a compliance team, and moving the whole business into a government cloud tenant would break how sales and operations work. Assessor capacity is also limited, so waiting is not an option either.

## Scope first

The biggest cost lever in a small-business CMMC program is scope, so I fix the boundary before building controls.

Most staff in a small contractor never need to touch CUI. The commercial side gets the CMMC Level 1 practice set, plus Level 2 capability where it costs nothing extra. CUI goes into an enclave: an encrypted store used by a small number of US-person users. My reading is that this keeps the Level 2 assessment boundary to the enclave and the people who use it, rather than the whole company. That reading needs to hold up in front of an assessor, so the scoping rationale goes into the SSP rather than staying in my head.

| Zone: | Handles CUI: | Built to: |
|---|---|---|
| Commercial environment | No | CMMC Level 1, Level 2 capability where free |
| CUI enclave | Yes | CMMC Level 2, NIST SP 800-171 |
| Security tooling (SIEM, RMM, password manager) | No, but security protection assets | Documented in the ESP and CSP register |

*The table shows why scope comes first: only one zone carries the full Level 2 burden.*

## Level 1 on the commercial side

Level 1 is the 15 basic safeguarding requirements of FAR 52.204-21. In practice it comes down to unique accounts with MFA, legacy authentication and device code flow blocked, no standing local admin rights, control over remote-access tools, and malware protection and patching managed centrally. Most of it can land as a side effect of work the business needs anyway, such as a [mail migration](/work/mail-migration/) and an [endpoint baseline](/work/endpoint-baseline/).

## The SSP and the evidence trail

I write the System Security Plan against NIST SP 800-171 Rev 2, which is the revision CMMC Level 2 assessments currently reference. On my reading, Rev 3 is unlikely to apply before recertification, so I record the Rev 3 organization-defined parameters in the SSP now. A later move then becomes an edit rather than a rewrite.

Every requirement is traceable from the SSP statement, to the policy, to the implementation, to an evidence artifact an assessor can open. Alongside it sit two registers that small contractors often leave until the week of the assessment:

- an external and cloud service provider register, with a customer responsibility matrix for each service in or near scope
- a FIPS reference sheet listing the CMVP certificate number for every validated cryptographic module the SSP relies on

## ISO/IEC 27001:2022

The same evidence feeds an ISO/IEC 27001:2022 ISMS. Controls are written once so that a single implementation produces evidence for the CMMC practice, the 800-171 requirement and the Annex A control together. Internal audit is set up under ISO 19011 guidance, with a written authorization record for the auditor role.

## What I would tell another small contractor

Book the assessor early. C3PAO capacity is the constraint most small contractors underestimate.

Expect the assessment to test traceability more than tooling. In my experience the failure points are an SSP that does not match the policy, a policy that does not match the system, a missing service provider register, admin separation that has only been tested in one direction and FIPS claims that stop at "we use BitLocker" without a certificate number behind them.
