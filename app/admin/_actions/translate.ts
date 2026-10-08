'use server';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { asUser } from '@/lib/db';
import { env } from '@/lib/env';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { rateLimit } from '@/lib/rate-limit';
import { slugify } from '@/lib/slug';

/*
 * Optional "draft translation" for PUBLIC content only (recipes, guides).
 * Client data is never sent to any third-party AI service — this action only ever reads
 * recipe_translations / article_translations. Output is a draft: the editor saves it as
 * "needs_review", and ar/fr stay off the public site until a native speaker marks them reviewed.
 */

const recipeDraft = z.object({
  title: z.string(),
  summary: z.string(),
  steps: z.array(z.string()),
  tips: z.string().nullable(),
});
const articleDraft = z.object({ title: z.string(), excerpt: z.string(), body: z.string() });

const recipeSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    tips: { type: ['string', 'null'] },
  },
  required: ['title', 'summary', 'steps', 'tips'],
  additionalProperties: false,
} as const;

const articleSchema = {
  type: 'object',
  properties: { title: { type: 'string' }, excerpt: { type: 'string' }, body: { type: 'string' } },
  required: ['title', 'excerpt', 'body'],
  additionalProperties: false,
} as const;

export type DraftResult =
  | { ok: true; kind: 'recipe'; draft: z.infer<typeof recipeDraft> & { slug: string } }
  | { ok: true; kind: 'article'; draft: z.infer<typeof articleDraft> & { slug: string } }
  | { ok: false; error: 'unavailable' | 'rateLimited' | 'noSource' | 'refused' | 'failed' };

export async function draftTranslationAction(
  kind: 'recipe' | 'article',
  id: string,
  to: Locale,
): Promise<DraftResult> {
  const user = await requireUser();
  if (!env.anthropicApiKey) return { ok: false, error: 'unavailable' };
  if (
    !z.uuid().safeParse(id).success ||
    !(locales as readonly string[]).includes(to) ||
    to === 'tr'
  )
    return { ok: false, error: 'failed' };
  if (!(await rateLimit('translate', 3600, 30))) return { ok: false, error: 'rateLimited' };

  const table = kind === 'recipe' ? 'recipe_translations' : 'article_translations';
  const idCol = kind === 'recipe' ? 'recipe_id' : 'article_id';
  const cols =
    kind === 'recipe'
      ? 'locale::text as locale, slug, title, summary, steps, tips'
      : 'locale::text as locale, slug, title, excerpt, body';
  const rows = await asUser(user.id, (tx) =>
    tx.query<Record<string, unknown> & { locale: Locale; slug: string }>(
      `select ${cols} from ${table} where ${idCol} = $1 and locale in ('tr', 'en')`,
      [id],
    ),
  );
  const source = rows.find((r) => r.locale === 'tr') ?? rows.find((r) => r.locale === 'en');
  if (!source) return { ok: false, error: 'noSource' };
  const { locale: from, slug: sourceSlug, ...content } = source;

  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const system = [
    `You translate public nutrition content for a Turkish dietitian's website from ${localeNames[from]} into ${localeNames[to]}.`,
    'Keep the meaning exact: do not add health claims, promises, numbers or advice that are not in the source.',
    'Keep the warm, direct, body-neutral tone. Keep ingredient quantities, units and step order unchanged.',
    to === 'ar'
      ? 'Write Modern Standard Arabic with Western digits (0-9). Keep dish names recognisable (transliterate Turkish dish names).'
      : '',
    to === 'fr'
      ? 'Use French typography: a narrow no-break space before : ; ? ! and « » quotes. Address the reader with "tu".'
      : '',
    kind === 'article'
      ? 'The body uses blank-line paragraphs, "## " subheadings and "- " bullets: keep that structure.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    // Server-side fallback: if the primary model declines, the API re-runs the request on a fallback
    // model inside the same call (routing chosen by refusal category).
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: JSON.stringify(content) }],
      output_config: {
        format: { type: 'json_schema', schema: kind === 'recipe' ? recipeSchema : articleSchema },
      },
    });
    if (response.stop_reason === 'refusal') return { ok: false, error: 'refused' };
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const parsed = JSON.parse(text) as unknown;
    const slugBase = to === 'ar' ? sourceSlug : '';
    if (kind === 'recipe') {
      const d = recipeDraft.parse(parsed);
      return { ok: true, kind, draft: { ...d, slug: slugify(d.title) || `${slugBase}-${to}` } };
    }
    const d = articleDraft.parse(parsed);
    return { ok: true, kind, draft: { ...d, slug: slugify(d.title) || `${slugBase}-${to}` } };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: 'rateLimited' };
    console.error(
      'draft translation failed',
      error instanceof Anthropic.APIError ? error.status : 'parse',
    );
    return { ok: false, error: 'failed' };
  }
}
