---
title: Google Workspace to MS 365, with a new identity baseline
claim: How I move a business from Google Workspace to MS 365 and rebuild the identity baseline on the way, without a big-bang cutover.
evidence: A phased migration on MigrationWiz with a gate at the end of each phase, oversized mailboxes split into their own project, leavers handled as shared mailboxes, and Security Defaults replaced by a Conditional Access baseline with break-glass accounts.
kind: Migration
frameworks:
  - MS 365
  - Exchange Online
  - Entra ID Conditional Access
  - MigrationWiz
setting: Defense sector
order: 2
related:
  - migrationwiz-mailbox-size-is-not-source-size
  - aadsts50079-security-defaults-to-conditional-access
---

## Constraints

Two things tend to drive the plan. MS announced that EWS in Exchange Online would be blocked by default from October 2026 unless an app is on the tenant's allow list, and the migration tool writes to the destination over EWS. And when a compliance baseline depends on the move, identity and device controls are better built on the new tenant than retrofitted to the old one.

## What I do

I plan the migration in phases with a gate at the end of each, run it on BitTitan MigrationWiz and own the MS-side and Google-side configuration myself. Field tasks such as data extraction and device rebuilds each get one named owner.

- Vanity domains route into a single tenant.
- Mailboxes go in separate projects for primary, shared and archive data, with a split project for the oversized ones so they cannot block everyone else.
- Leavers' mailboxes that still receive mail become shared mailboxes with permissions and retention, rather than licensed accounts.
- Users move to freshly built laptops on a rotation. Anyone still waiting works in Outlook on the web.

## Decisions and trade-offs

**Identity mid-flight.** A migration service account can fail destination authentication with AADSTS50079 while the tenant still runs Security Defaults. Rather than weaken Security Defaults, I replace them with a Conditional Access baseline and a scoped, time-boxed exclusion for the migration account. The full reasoning is in [the write-up](/writing/aadsts50079-security-defaults-to-conditional-access/).

**Size forecasts.** MigrationWiz can report destination sizes well above what Google shows. The gap is Gmail labels becoming folders, which duplicates any message with more than one label, and shared team inboxes carry the largest multipliers. That changes which mailboxes fit and how long passes take, so I measure it before planning the cutover. [Measured detail here](/writing/migrationwiz-mailbox-size-is-not-source-size/).

**Throughput.** EWS throttling relief stops passes from aborting, but the per-mailbox write rate stays capped. Large mailboxes are planned around that ceiling, not around the relief.

**Legacy authentication.** Anything that reads a mailbox without modern authentication becomes a cutover blocker with its own exclusion group and a vendor question, rather than something to discover on cutover night.
