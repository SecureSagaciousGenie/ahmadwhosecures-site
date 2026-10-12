// Author: Ahmad Shaukat
// Newest first; same-day articles fall back to their order field.
import type { CollectionEntry } from 'astro:content';

export const byNewest = (a: CollectionEntry<'writing'>, b: CollectionEntry<'writing'>) =>
  b.data.date.valueOf() - a.data.date.valueOf() || a.data.order - b.data.order;
