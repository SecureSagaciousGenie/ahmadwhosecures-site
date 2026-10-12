// Author: Ahmad Shaukat
// RSS feed for articles.
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../site.config';
import { byNewest } from '../lib/sort';

export async function GET(context) {
  const writing = (await getCollection('writing', ({ data }) => !data.draft)).sort(byNewest);
  return rss({
    title: `${site.name}: writing`,
    description: site.description,
    site: context.site,
    items: writing.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.date,
      link: `/writing/${entry.id}/`,
    })),
  });
}
