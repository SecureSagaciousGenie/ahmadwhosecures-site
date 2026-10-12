---
title: Google Workspace to MS 365, with a new identity baseline
claim: Moved a business from Google Workspace to MS 365 across three mail domains, and rebuilt the identity baseline on the way.
evidence: 78 user and 17 shared mailboxes, about 1.8 TB, migrated with MigrationWiz into one tenant. Security Defaults replaced mid-migration by a five-policy Conditional Access baseline with break-glass accounts.
status: In progress
statusNote: Mailbox data migrated. Cutover tail and device rebuilds under way.
frameworks:
  - MS 365
  - Exchange Online
  - Entra ID Conditional Access
  - MigrationWiz
  - CMMC Level 1
setting: US defense contractor
period: August to October 2026
order: 2
related:
  - migrationwiz-mailbox-size-is-not-source-size
  - aadsts50079-security-defaults-to-conditional-access
---

## Setting

The business ran on Google Workspace Business Starter with three mail domains. Federal sales teams used a handful of very large shared mailboxes, one line-of-business system read a mailbox over legacy authentication, and several leavers' accounts were still delivering mail into active users' inboxes.

## Constraints

Two dates drove the plan. MS announced that EWS in Exchange Online would be blocked by default from October 2026 unless an app is on the tenant's allow list, and the migration tool writes to the destination over EWS. The CMMC Level 1 baseline also depended on the move, because identity and device controls were to be built on the new tenant rather than the old one.

## What I did

I planned the migration in seven phases with a gate at the end of each, ran it on BitTitan MigrationWiz, and owned the MS-side and Google-side configuration myself. The IT team owned data extraction and device rebuilds, with one named owner for every field task.

- Three vanity domains route into a single tenant.
- Mailboxes went in four projects: primary, shared, archive and a split project for five oversized mailboxes, so the large ones could not block everyone else.
- Leavers' mailboxes that still received mail became shared mailboxes with permissions and retention, rather than licensed accounts.
- Users moved to freshly built laptops from a pool of swap devices on a two-day rotation. Anyone still waiting worked in Outlook on the web.

## Decisions and trade-offs

**Identity mid-flight.** The migration service account failed destination authentication with AADSTS50079 because the tenant still ran Security Defaults. Rather than weaken Security Defaults, I replaced them with a Conditional Access baseline and a scoped, time-boxed exclusion for the migration account. The full reasoning is in [the write-up](/writing/aadsts50079-security-defaults-to-conditional-access/).

**Size forecasts.** MigrationWiz reported destination sizes far above what Google showed. The gap turned out to be Gmail labels becoming folders, which duplicates any message with more than one label. Two shared mailboxes carried multipliers of 1.67 and 1.82. That changed which mailboxes would fit and how long passes would take. [Measured detail here](/writing/migrationwiz-mailbox-size-is-not-source-size/).

**Throughput.** EWS throttling relief stopped passes from aborting, but the per-mailbox write rate stayed capped. Large mailboxes were planned around that ceiling, not around the relief.

**Legacy authentication.** The line-of-business system that reads a mailbox could not do modern authentication. That made it a cutover blocker with its own exclusion group and a vendor question, rather than something to discover on cutover night.

## Where it stands

Bulk mailbox data is in MS 365. The cutover tail, leaver mailbox handling and laptop rebuild rotation are under way, with location-based access rules held in report-only until cutover completes.
