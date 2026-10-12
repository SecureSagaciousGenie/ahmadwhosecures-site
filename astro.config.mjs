// Author: Ahmad Shaukat
// Site build configuration for ahmadwhosecures.is-a.dev
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ahmadwhosecures.is-a.dev',
  integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/404') })],
  build: {
    format: 'directory',
    // Keep all CSS in external files so the Content-Security-Policy can stay strict.
    inlineStylesheets: 'never',
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: false,
    },
  },
});
