import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getExampleWeek, getSiteSettings, listArticles, listRecipes } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { absoluteUrl, pageMetadata } from '@/lib/seo';
import { Faq } from '@/components/site/home/faq';
import { ContactSection } from '@/components/site/home/contact-section';
import { Hero } from '@/components/site/home/hero';
import { RecipesTeaser } from '@/components/site/home/recipes-teaser';
import { Story } from '@/components/site/home/story';
import { ToolsIndex } from '@/components/site/home/tools-index';
import { Week } from '@/components/site/home/week';
import { WizardTeaser } from '@/components/site/home/wizard-teaser';
import { ApplyBand } from '@/components/site/home/apply-band';
import { GuidesIndex } from '@/components/site/guides-index';
import { Ingredient } from '@/components/site/ingredients';
import { JsonLd } from '@/components/site/json-ld';
import { Section, SectionHead, SectionTag } from '@/components/site/section';
import { Marquee } from '@/components/motion/marquee';
import { ArrowIcon } from '@/components/ui/motion-button';
import { MotionLink } from '@/components/ui/motion-link';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/', null);
}

const MARQUEE_ART = [
  'chickpea',
  'lemon',
  'yogurt',
  'walnut',
  'pomegranate',
  'oats',
  'olive',
  'lentil',
  'fig',
  'egg',
  'cucumber',
  'fish',
  'tomato',
  'oats',
];

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tf = await getTranslations('faq');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const [settings, recipes, articles, week] = await Promise.all([
    getSiteSettings(locale),
    listRecipes(locale),
    listArticles(locale),
    getExampleWeek(locale),
  ]);
  const lines = settings.hero.lines ?? (t.raw('hero.lines') as string[]);
  const lead = settings.hero.lead ?? t('hero.lead');
  const faqItems = settings.faq.items ?? (tf.raw('items') as { q: string; a: string }[]);
  const marquee = t.raw('marquee.items') as string[];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Diyetiko',
          url: absoluteUrl(locale === 'tr' ? '/' : `/${locale}`),
          telephone: settings.contact.phoneE164,
          sameAs: [`https://instagram.com/${settings.contact.instagram}`],
          knowsLanguage: ['tr', 'en', 'ar', 'fr'],
        }}
      />

      <Hero lines={lines} lead={lead} whatsapp={settings.contact.whatsapp} />

      <div className="on-dark bg-green grain-light py-5 text-paper">
        <Marquee label={t('marquee.label')}>
          {marquee.map((word, i) => (
            <span key={i} className="flex items-center gap-5">
              <Ingredient
                name={MARQUEE_ART[i % MARQUEE_ART.length]!}
                className="size-12 shrink-0"
              />
              <span className="font-display text-[clamp(1.75rem,3.6vw,3rem)] leading-none whitespace-nowrap italic ar:font-bold ar:not-italic">
                {word}
              </span>
            </span>
          ))}
        </Marquee>
      </div>

      <Story />

      <Section tone="paper" labelledBy="wizard-title">
        <SectionHead
          id="wizard-title"
          eyebrow={t('wizard.eyebrow')}
          tone="orange"
          title={t('wizard.title')}
          lead={t('wizard.lead')}
          action={
            <MotionLink href="/goal" variant="outline" icon={<ArrowIcon />}>
              {t('wizard.cta')}
            </MotionLink>
          }
        />
        <div className="container-x mt-12">
          <WizardTeaser />
        </div>
      </Section>

      <ApplyBand />

      <Section tone="ink" labelledBy="tools-title">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5">
            <SectionTag tone="cream">{t('tools.eyebrow')}</SectionTag>
            <h2
              id="tools-title"
              className="mt-5 font-display text-display-lg tracking-[-0.025em] ar:leading-[1.25] ar:font-bold ar:tracking-normal"
            >
              {t('tools.title')}
            </h2>
            <p className="mt-5 max-w-md text-lead text-sage">{t('tools.lead')}</p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <ToolsIndex recipeCount={recipes.length} />
          </div>
        </div>
      </Section>

      <Section tone="paper" labelledBy="recipes-title">
        <SectionHead
          id="recipes-title"
          eyebrow={t('recipes.eyebrow')}
          title={t('recipes.title')}
          lead={t('recipes.lead')}
          action={
            <MotionLink href="/recipes" variant="outline" icon={<ArrowIcon />}>
              {tc('seeAll')}
            </MotionLink>
          }
        />
        <RecipesTeaser recipes={recipes.slice(0, 5)} />
      </Section>

      <div className="bg-paper-2 grain">
        <Week days={week} />
      </div>

      <Section tone="paper" labelledBy="guides-title">
        <SectionHead
          id="guides-title"
          eyebrow={t('guides.eyebrow')}
          title={t('guides.title')}
          lead={t('guides.lead')}
          action={
            <MotionLink href="/guides" variant="outline" icon={<ArrowIcon />}>
              {tn('guides')}
            </MotionLink>
          }
        />
        <div className="container-x mt-12 lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-10 lg:col-start-3">
            <GuidesIndex articles={articles.slice(0, 5)} />
          </div>
        </div>
      </Section>

      <Section tone="green" labelledBy="faq-title">
        <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <SectionTag tone="cream">{t('faq.eyebrow')}</SectionTag>
            <h2
              id="faq-title"
              className="mt-5 font-display text-display-lg tracking-[-0.025em] ar:leading-[1.25] ar:font-bold ar:tracking-normal"
            >
              {t('faq.title')}
            </h2>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <Faq items={faqItems} tone="dark" />
          </div>
        </div>
      </Section>

      <ContactSection contact={settings.contact} eyebrow={t('contact.eyebrow')} />
    </>
  );
}
