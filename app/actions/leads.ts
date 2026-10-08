'use server';

import type { z } from 'zod';
import { asService, json } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import {
  CONSENT_VERSIONS,
  applicationSchema,
  contactSchema,
  professionalSchema,
  wizardLeadSchema,
  type LeadResult,
} from '@/lib/validators/lead';

/*
 * Public lead intake. Anonymous visitors never touch tables directly: this action validates
 * with zod, drops bots (honeypot), rate-limits by salted IP hash, and inserts with the service
 * role for the site owner. No personal data is logged.
 */

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function siteOwner(): Promise<string | null> {
  const [row] = await asService((tx) =>
    tx.query<{ id: string }>(
      `select id from profiles where role = 'dietitian' order by created_at limit 1`,
    ),
  );
  return row?.id ?? null;
}

async function insertLead(lead: {
  kind: 'contact' | 'wizard' | 'professional' | 'application';
  name: string;
  email: string;
  phone: string;
  organization?: string | null;
  message?: string | null;
  payload: Record<string, unknown>;
  locale: string;
}): Promise<LeadResult> {
  if (!(await rateLimit('lead', 600, 5))) return { ok: false, error: 'rateLimited' };
  const owner = await siteOwner();
  if (!owner) return { ok: false, error: 'generic' };
  const insert = (kind: string, payload: Record<string, unknown>) =>
    asService((tx) =>
      tx.query(
        `insert into leads (owner_id, kind, name, email, phone, organization, message, payload, locale, consent_at, consent_version)
         values ($1, $2, $3, nullif($4, ''), nullif($5, ''), nullif($6, ''), nullif($7, ''), $8::jsonb, $9, now(), $10)`,
        [
          owner,
          kind,
          lead.name,
          lead.email,
          lead.phone,
          lead.organization ?? '',
          lead.message ?? '',
          json(payload),
          lead.locale,
          CONSENT_VERSIONS[lead.kind],
        ],
      ),
    );
  try {
    try {
      await insert(lead.kind, lead.payload);
    } catch (error) {
      // 22P02: the database does not know the 'application' kind yet (migration …000007 not
      // run). Keep the application anyway, marked so the panel still shows it as one.
      if (lead.kind !== 'application' || (error as { code?: string }).code !== '22P02') throw error;
      await insert('contact', { ...lead.payload, form: 'application' });
    }
    return { ok: true };
  } catch (error) {
    console.error('lead insert failed', (error as { code?: string }).code ?? 'unknown');
    return { ok: false, error: 'generic' };
  }
}

export async function submitContact(input: unknown): Promise<LeadResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'validation', fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.website) return { ok: true }; // bot: pretend success, store nothing
  return insertLead({
    kind: 'contact',
    name: d.name,
    email: d.email,
    phone: d.phone,
    message: d.message,
    payload: { preferred: d.preferred },
    locale: d.locale,
  });
}

export async function submitProfessional(input: unknown): Promise<LeadResult> {
  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'validation', fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.website) return { ok: true };
  return insertLead({
    kind: 'professional',
    name: d.name,
    email: d.email,
    phone: d.phone,
    organization: d.organization || null,
    message: d.message,
    payload: { profession: d.profession },
    locale: d.locale,
  });
}

export async function submitApplication(input: unknown): Promise<LeadResult> {
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'validation', fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.website) return { ok: true };
  const { name, email, phone, message, locale, ...rest } = d;
  const { consent: _c, website: _w, terms: _t, ...answers } = rest;
  return insertLead({
    kind: 'application',
    name,
    email,
    phone,
    message: message || null,
    payload: { ...answers, termsAccepted: true },
    locale,
  });
}

export async function submitWizardLead(input: unknown): Promise<LeadResult> {
  const parsed = wizardLeadSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'validation', fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.website) return { ok: true };
  return insertLead({
    kind: 'wizard',
    name: d.name,
    email: d.email,
    phone: d.phone,
    payload: d.answers,
    locale: d.locale,
  });
}
