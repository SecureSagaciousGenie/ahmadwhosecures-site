// Author: Ahmad Shaukat
// Site build configuration for ahmadwhosecures.is-a.dev
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ahmadwhosecures.is-a.dev',
  integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/404') })],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  build: {
    format: 'directory',
    // Keep all CSS in external files so the Content-Security-Policy can stay strict.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Never inline scripts or assets into HTML; script-src is 'self' only.
      assetsInlineLimit: 0,
    },
  },
  markdown: {
    shikiConfig: {
      // Both themes ship as CSS variables; global.css picks one from the page theme.
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
    },
  },
});
