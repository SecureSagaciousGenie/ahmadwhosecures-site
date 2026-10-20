# ahmadwhosecures-site

Author: Ahmad Shaukat

Source for [ahmadwhosecures.is-a.dev](https://ahmadwhosecures.is-a.dev): case studies and field notes on defense-sector security work. Built with Astro as a fully static site. Fonts are self-hosted, no third-party origin is contacted and every page works with JavaScript blocked.

## Structure

| Path: | Holds: |
|---|---|
| `src/site.config.ts` | Name, role, links and the optional public email |
| `src/content/work/` | Case studies; each one is a row in the case-file ledger |
| `src/content/writing/` | Articles |
| `src/pages/` | Page templates |
| `src/components/` | Header, footer, ledger, evidence trail, sign-in panel, search and the rest |
| `src/lib/signin.ts` | The example Conditional Access policy set and its evaluation |
| `src/scripts/app.ts` | The only client script: progressive enhancement, see below |
| `src/styles/global.css` | All styling and design tokens, dark and light |
| `public/_headers` | Security headers for Cloudflare Pages |
| `public/.well-known/security.txt` | Security contact (RFC 9116); renew `Expires` before April 2027 |
| `public/diagrams/` | Article diagrams |
| `public/og.png` | Link preview image, 1200 by 630 |
| `tests/` | Scenario tests for the sign-in panel |

## What the script adds

The pages are complete as static HTML. `src/scripts/app.ts` adds the following, and each feature returns quietly when its markup is absent.

| Feature: | Without JavaScript: |
|---|---|
| Hero name flips between "Ahmad who Secures" and "Ahmad Shaukat" | Shows "Ahmad who Secures"; screen readers always get the name |
| Evidence trail autoplay, paused on hover, focus or when off screen | The requirement picker is a radio group and works in CSS alone |
| Sign-in panel re-evaluates on every change | Shows one rendered example and the policy trace |
| Search: Ctrl+K, Cmd+K or / | Navigation links only |
| Light and dark theme switch, remembered per browser | Dark theme |
| Copy buttons on code blocks, reading progress, section highlighting | Plain code blocks and section list |

Animation and autoplay stop when the visitor's system asks for reduced motion. Page changes use cross-document view transitions in browsers that support them, so there is no client-side router.

## Design

| Element: | Choice: |
|---|---|
| Colour | Navy ink and signal amber; status colours follow assessment usage: green implemented or shipped, blue in progress, red blocked |
| Type | Hubot Sans (display, expanded width), IBM Plex Sans (text), JetBrains Mono (labels and code) |
| Theme | Dark by default; a full light theme behind the switch |
| Code | Shiki with `github-light` and `github-dark-default`, chosen by the page theme |

## Local build

Needs Node 22.12 or later.

```bash
npm ci
npm run dev               # http://localhost:4321
npm test                  # sign-in panel scenarios
npm run build             # output in dist/
npm run preview:headers   # serves dist/ with the headers from public/_headers
```

`preview:headers` applies the production Content-Security-Policy, so a violation shows in the browser console before it reaches Cloudflare. It drops `upgrade-insecure-requests` and HSTS, which plain-HTTP localhost cannot honour.

## Adding content

A new case study is a Markdown file in `src/content/work/` with the frontmatter fields used by the existing files. `status` is `Implemented`, `In progress` or `Shipped`. `order` sets its position in the ledger and its CF number.

A new article is a Markdown file in `src/content/writing/`. Set `draft: true` to keep it out of the build.

Before publishing anything about client work: describe the employer by industry, keep identifiers out (tenant and app IDs, addresses, hostnames, account and group names, vendor-to-system maps) and use lab data for DFIR material. The sign-in panel uses an example policy set for the same reason.

## Deploy: Cloudflare Pages

1. Cloudflare dashboard: Workers & Pages, Create, choose Pages, then import this Git repository.
2. Project name `ahmadwhosecures`, framework preset Astro, build command `npm run build`, output directory `dist`.
3. Deploy. The site goes live at `ahmadwhosecures.pages.dev`. Pushes to other branches build preview deployments at `<branch>.ahmadwhosecures.pages.dev`.

## Custom domain: is-a.dev

1. Fork [is-a-dev/register](https://github.com/is-a-dev/register) and add `domains/ahmadwhosecures.json`:

   ```json
   {
     "owner": {
       "username": "SecureSagaciousGenie"
     },
     "records": {
       "CNAME": "ahmadwhosecures.pages.dev"
     }
   }
   ```

2. Open a pull request. Merged PRs are public and cannot be retracted, so the file carries no email.
3. After the merge, attach `ahmadwhosecures.is-a.dev` to the Pages project through the Cloudflare API. is-a.dev is on the Public Suffix List, so the dashboard cannot add it. `scripts/Add-PagesCustomDomain.ps1` does this from Windows PowerShell 5.1 or PowerShell 7. It prompts for an API token scoped to Account, Cloudflare Pages, Edit; revoke the token afterwards.

   ```powershell
   .\scripts\Add-PagesCustomDomain.ps1 -AccountId YOUR_32_CHARACTER_ACCOUNT_ID
   ```
