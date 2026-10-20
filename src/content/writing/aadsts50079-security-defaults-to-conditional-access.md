---
title: "AADSTS50079 on a migration account: replacing Security Defaults with Conditional Access"
description: Why a migration service account failed destination authentication under Entra Security Defaults, and how a five-policy Conditional Access baseline replaced them without weakening the tenant.
date: 2026-10-12
order: 2
topics:
  - Entra ID
  - Conditional Access
  - MS 365
  - MigrationWiz
---

Halfway through setting up a Google Workspace to MS 365 migration, the destination endpoint in MigrationWiz stopped verifying. The error was AADSTS50079. The fix was not a setting in the migration tool. It was the tenant's identity baseline.

## The symptom

The migration account held the Exchange Administrator role, with no licence and no mailbox. The tenant was new and still ran Entra Security Defaults. Verify Credentials on the destination endpoint returned AADSTS50079, which Entra uses when a user must enroll in multi-factor authentication before sign-in can complete.

## Why it fails

Security Defaults require every account to register for MFA and require MFA on every sign-in for privileged roles. A migration tool signs in on its own, with no person at a keyboard to answer a prompt. An admin-role account under Security Defaults will always hit the MFA wall.

Security Defaults cannot be customized. Apart from directory synchronization accounts, MS documents no way to exempt an account while keeping the defaults for everyone else. That leaves two real choices: switch Security Defaults off and leave the tenant with nothing, or replace them with Conditional Access policies that do the same job and allow a scoped exclusion.

## The options

| Option: | Result: | Trade-off: |
|---|---|---|
| Register MFA on the migration account | Interactive sign-in works | The tool still cannot answer a prompt, so the error stays |
| Turn Security Defaults off and stop there | Migration works | Tenant has no MFA enforcement at all; not acceptable |
| Replace Security Defaults with Conditional Access and a scoped exclusion | Migration works and the tenant is stronger than before | Needs Entra ID P1, which Business Premium includes; the exclusion is a gap to manage |

## The baseline

Five policies replaced Security Defaults. Each does one job, so a sign-in log entry points at one policy rather than a bundle.

| Policy: | Applies to: | Control: |
|---|---|---|
| Require MFA | All users | Grant: require MFA |
| Require MFA for admin roles | Privileged directory roles | Grant: require MFA |
| Block legacy authentication | All users, all cloud apps, legacy client apps | Block |
| Block device code flow | All users, device code authentication flow | Block |
| Require MFA for admin portals | All users, MS admin portals | Grant: require MFA |

*Five narrow policies cover what Security Defaults covered, plus device code flow, and each can be excluded or tightened on its own.*

The admin-role and admin-portal policies overlap with the all-users policy on purpose. When the tenant later moves to tiered access and the all-users policy is split by group, admin roles and admin portals keep their own MFA requirement and do not depend on the split being right.

## Break-glass and exclusion groups

Two cloud-only break-glass accounts sit on the tenant's onmicrosoft.com domain, excluded from every policy through one group. MS now enforces MFA on its admin portals for every account, so the break-glass accounts have MFA registered and their credentials are held offline.

Exclusions go through groups named for their purpose, never through individual users on a policy: one for break-glass, one for accounts that cannot do MFA or modern authentication, such as a migration account, and one for each other exception, such as device code flow. A reviewer can read the intent from the group name, and an assessor can see exactly who is outside each control.

## Order of operations

1. Create the break-glass accounts, register MFA, store the credentials and test a sign-in.
2. Create the exclusion groups and add the break-glass accounts.
3. Build all five policies in report-only and check the report-only results in the sign-in logs.
4. In one change window, switch Security Defaults off and switch the policies on.
5. Re-run Verify Credentials on the destination endpoint.

Steps 4 and 5 took minutes. The point of steps 1 to 3 is that the window between Security Defaults off and policies on is short and nobody is locked out during it.

## Managing the exclusion

An excluded account is a gap, so it gets compensating controls:

- unlicensed, no mailbox and a single admin role
- a long random password held in the password vault and used only by the migration tool
- excluded only from the policies it cannot satisfy, not from the whole baseline
- sign-in log review for the account during the project
- a removal date in the change record, with the app registration secret set to expire shortly after as a backstop

BitTitan confirmed none of their IPs needed allow-listing, so a named-location restriction on the account was not available. That is a real weakness and the reason the review and removal date matter.

## MigrationWiz settings that mattered

The destination endpoint had to use Provide Credentials, not Do not provide credentials. Use Impersonation to Authenticate only appears under Provide Credentials, and it is set per project, so every project needed it. The app registration followed BitTitan's API permissions article: delegated EWS.AccessAsUser.All, application full_access_as_app and public client flows enabled.

## Result

The first trial pass completed with zero errors on the day of the change, and production passes started the next day. The tenant came out with an explicit baseline it can build on, rather than defaults it would have had to switch off later anyway.

### Sources

- MS Learn: [security defaults in Entra ID](https://learn.microsoft.com/en-us/entra/fundamentals/security-defaults)
- MS Learn: [Entra authentication and authorization error codes](https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes)
- MS Learn: [block legacy authentication with Conditional Access](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-legacy-authentication)
- MS Learn: [Conditional Access authentication flows](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-authentication-flows)
