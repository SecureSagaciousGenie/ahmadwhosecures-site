// Author: Ahmad Shaukat
// Content collections: case studies (work) and articles (writing).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Client work carries no status, period or progress note, so a case never describes what an
// employer has or has not finished. Only public work, such as open-source tools, sets a status.
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    claim: z.string(),
    evidence: z.string(),
    kind: z.string(),
    status: z.enum(['Shipped']).optional(),
    statusNote: z.string().optional(),
    frameworks: z.array(z.string()),
    setting: z.string(),
    period: z.string().optional(),
    order: z.number(),
    related: z.array(z.string()).default([]),
  }),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    topics: z.array(z.string()),
    draft: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { work, writing };
