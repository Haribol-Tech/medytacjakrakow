import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const aktualnosci = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/aktualnosci' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string().optional(),
    image: z.string().optional(),
    kategoria: z.enum(['medytacja', 'zajecia-stacjonarne', 'relaks', 'kirtan']).optional(),
  }),
});

const zajecia = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/zajecia' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    image: z.string().optional(),
    kolejnosc: z.number().optional(),
  }),
});

export const collections = { aktualnosci, zajecia };
