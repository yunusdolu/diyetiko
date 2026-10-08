import { cn } from '@/lib/utils';

/**
 * CSS-driven kinetic headline for above-the-fold text (no JS needed → no LCP delay).
 * Latin: per-character masked rise. Arabic: per-word (never split characters).
 * Each unit gets --i for staggering; see `.kin-unit` in globals.css.
 *
 * The mask is per WORD (a clip-path reaching past the word on every side: the dot of a large İ,
 * accents, the tails of y/g/ş and italic overhangs stay whole). A per-line mask let letters of a
 * line that wrapped onto a second row show under the first row before rising.
 * `accent` indexes a line rendered in italic Didone (Latin only; Arabic never italic).
 */
/** a word's window: generous on every side so nothing of a resting letter is ever cut */
const WORD_MASK = 'inline-block whitespace-nowrap [clip-path:inset(-0.4em_-0.5em_-0.3em_-0.5em)]';

export function KineticHeadline({
  lines,
  locale,
  className,
  accent,
  lineClassName,
}: {
  lines: string[];
  locale: string;
  className?: string;
  accent?: number;
  lineClassName?: (index: number) => string;
}) {
  const byWord = locale === 'ar';
  let i = 0;
  return (
    <h1 className={className}>
      <span className="sr-only">{lines.join(' ')}</span>
      <span aria-hidden className="block">
        {lines.map((line, li) => (
          <span
            key={li}
            className={cn(
              'kin-line block pb-[0.08em]',
              li === accent && !byWord && 'italic',
              lineClassName?.(li),
            )}
          >
            {byWord
              ? line.split(/(\s+)/).map((w, wi) =>
                  /^\s+$/.test(w) ? (
                    <span key={wi}> </span>
                  ) : (
                    <span key={wi} className={WORD_MASK}>
                      <span className="kin-unit inline-block" style={{ ['--i' as string]: i++ }}>
                        {w}
                      </span>
                    </span>
                  ),
                )
              : line.split(/(\s+)/).map((w, wi) =>
                  /^\s+$/.test(w) ? (
                    <span key={wi}> </span>
                  ) : (
                    <span key={wi} className={WORD_MASK}>
                      {Array.from(w).map((c, ci) => (
                        <span
                          key={ci}
                          className="kin-unit inline-block"
                          style={{ ['--i' as string]: i++ }}
                        >
                          {c}
                        </span>
                      ))}
                    </span>
                  ),
                )}
          </span>
        ))}
      </span>
    </h1>
  );
}
