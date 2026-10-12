# ahmadwhosecures-site

Author: Ahmad Shaukat

Source for [ahmadwhosecures.is-a.dev](https://ahmadwhosecures.is-a.dev): case studies and field notes on defense-sector security work. Built with Astro as a fully static site. No JavaScript is shipped, fonts are self-hosted and no third-party origin is contacted.

## Structure

| Path: | Holds: |
|---|---|
| `src/site.config.ts` | Name, role, links and the optional public email |
| `src/content/work/` | Case studies; each one is a row in the home page ledger |
| `src/content/writing/` | Articles |
| `src/pages/` | Page templates |
| `src/styles/global.css` | All styling and design tokens |
| `public/_headers` | Security headers for Cloudflare Pages |
| `public/.well-known/security.txt` | Security contact (RFC 9116); renew `Expires` before April 2027 |
| `public/diagrams/` | Article diagrams |

## Local build

Needs Node 22.12 or later.

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # output in dist/
```

## Adding content

A new case study is a Markdown file in `src/content/work/` with the frontmatter fields used by the existing files. `status` is `Implemented`, `In progress` or `Shipped`. `order` sets its position in the ledger.

A new article is a Markdown file in `src/content/writing/`. Set `draft: true` to keep it out of the build.

Before publishing anything about client work: describe the employer by industry, keep identifiers out (tenant and app IDs, addresses, hostnames, account and group names, vendor-to-system maps) and use lab data for DFIR material.

## Deploy: Cloudflare Pages

1. Cloudflare dashboard: Workers & Pages, Create, choose Pages, then import this Git repository.
2. Project name `ahmadwhosecures`, framework preset Astro, build command `npm run build`, output directory `dist`.
3. Deploy. The site goes live at `ahmadwhosecures.pages.dev`. If that name is taken, note the name Cloudflare assigns and use it in the next step.

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
3. After the merge, attach `ahmadwhosecures.is-a.dev` to the Pages project through the Cloudflare API. is-a.dev is on the Public Suffix List, so the dashboard cannot add it. Use an API token scoped to Pages edit only and revoke it afterwards.
