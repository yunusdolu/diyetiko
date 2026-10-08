import { z } from 'zod';
import { locales } from '@/lib/i18n/config';

/**
 * Lead schemas shared by the client (react-hook-form) and the server action.
 * Messages are error CODES; the UI maps them to translations in form.errors.*.
 */
export const CONSENT_VERSIONS = {
  contact: 'contact-2026-01',
  wizard: 'wizard-2026-01',
  professional: 'pro-2026-01',
  application: 'application-2026-10',
} as const;

const phone = z
  .string()
  .trim()
  .max(32, 'tooLong')
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'phone');

const optionalEmail = z.union([z.literal(''), z.email('email').max(254, 'tooLong')]);
const optionalPhone = z.union([z.literal(''), phone]);

const base = {
  name: z.string().trim().min(1, 'required').max(160, 'tooLong'),
  email: optionalEmail,
  phone: optionalPhone,
  consent: z.literal(true, { error: 'consent' }),
  /** honeypot — must stay empty */
  website: z.string().max(0).optional(),
  locale: z.enum(locales),
};

const needsContact = <T extends { email: string; phone: string }>(v: T) =>
  Boolean(v.email || v.phone);

export const contactSchema = z
  .object({
    ...base,
    message: z.string().trim().min(1, 'required').max(4000, 'tooLong'),
    preferred: z.enum(['whatsapp', 'phone', 'email']),
  })
  .refine(needsContact, { message: 'contact', path: ['email'] });

export const professionalSchema = z
  .object({
    ...base,
    profession: z.string().trim().min(1, 'required').max(120, 'tooLong'),
    organization: z.string().trim().max(160, 'tooLong').optional().or(z.literal('')),
    message: z.string().trim().min(1, 'required').max(4000, 'tooLong'),
  })
  .refine(needsContact, { message: 'contact', path: ['email'] });

export const wizardAnswersSchema = z.object({
  goal: z.enum(['energy', 'weight_down', 'weight_up', 'regular', 'sport', 'family']),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  habits: z
    .array(
      z.enum([
        'skip_breakfast',
        'late_eating',
        'snacking',
        'eat_out',
        'low_veg',
        'sweet_drinks',
        'low_water',
        'irregular',
      ]),
    )
    .max(8),
  time: z.enum(['t15', 't30', 't60', 't60plus']),
  // Optional stats: only stored if the visitor chose to fill them in AND consented.
  stats: z
    .object({
      sex: z.enum(['female', 'male']),
      age: z.number().int().min(18).max(100),
      heightCm: z.number().min(120).max(230),
      weightKg: z.number().min(35).max(300),
    })
    .nullable(),
});

export const wizardLeadSchema = z
  .object({
    ...base,
    answers: wizardAnswersSchema,
  })
  .refine(needsContact, { message: 'contact', path: ['phone'] });

/**
 * Programme application ("Başvuru"). Programmes run for at least three months — there is no
 * one-month option, and the applicant confirms it. Health questions are optional and covered by
 * an explicit consent (KVKK special-category data).
 */
export const APPLY_DURATIONS = ['m3', 'm6', 'm12'] as const;
export const APPLY_FORMATS = ['online', 'in_person', 'either'] as const;
export const APPLY_CONDITIONS = [
  'diabetes',
  'thyroid',
  'pcos',
  'blood_pressure',
  'cholesterol',
  'digestive',
  'kidney',
  'pregnancy',
] as const;
export const APPLY_STARTS = ['asap', 'month', 'later'] as const;
export const APPLY_TIMES = ['morning', 'afternoon', 'evening', 'any'] as const;
export const APPLY_GOALS = [
  'energy',
  'weight_down',
  'weight_up',
  'regular',
  'sport',
  'family',
  'health',
] as const;

const optNumber = (min: number, max: number) =>
  z.number({ error: 'invalid' }).min(min, 'range').max(max, 'range').nullable();
const optText = (max: number) => z.string().trim().max(max, 'tooLong');

export const applicationSchema = z
  .object({
    ...base,
    duration: z.enum(APPLY_DURATIONS, { error: 'required' }),
    format: z.enum(APPLY_FORMATS, { error: 'required' }),
    goal: z.enum(APPLY_GOALS, { error: 'required' }),
    goalNote: optText(600),
    sex: z.enum(['female', 'male', 'other']).nullable(),
    age: optNumber(16, 100),
    heightCm: optNumber(120, 230),
    weightKg: optNumber(35, 300),
    activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).nullable(),
    conditions: z.array(z.enum(APPLY_CONDITIONS)).max(APPLY_CONDITIONS.length),
    medications: optText(600),
    allergies: optText(600),
    priorDietitian: z.enum(['yes', 'no']).nullable(),
    start: z.enum(APPLY_STARTS, { error: 'required' }),
    contactTime: z.enum(APPLY_TIMES),
    preferred: z.enum(['whatsapp', 'phone', 'email']),
    message: optText(2000),
    /** "programmes are at least three months" */
    terms: z.literal(true, { error: 'terms' }),
  })
  .refine(needsContact, { message: 'contact', path: ['phone'] });
export type ApplicationInput = z.infer<typeof applicationSchema>;

export type ContactInput = z.infer<typeof contactSchema>;
export type ProfessionalInput = z.infer<typeof professionalSchema>;
export type WizardAnswers = z.infer<typeof wizardAnswersSchema>;
export type WizardLeadInput = z.infer<typeof wizardLeadSchema>;

export type LeadResult =
  | { ok: true }
  | {
      ok: false;
      error: 'validation' | 'rateLimited' | 'generic';
      fieldErrors?: Record<string, string>;
    };
