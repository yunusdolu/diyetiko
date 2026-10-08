import type { ReactNode } from 'react';

/**
 * Minimal, safe renderer for guide bodies: blank-line paragraphs, "## " subheadings,
 * "- " bullet lists. Everything is rendered as text nodes — no HTML injection possible.
 */
export function ArticleBody({ body }: { body: string }) {
  const blocks = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: ReactNode[] = [];
  blocks.forEach((block, i) => {
    if (block.startsWith('## ')) {
      out.push(
        <h2
          key={i}
          className="mt-14 font-display text-display-md tracking-[-0.015em] first:mt-0 ar:leading-[1.35] ar:font-bold ar:tracking-normal"
        >
          {block.slice(3)}
        </h2>,
      );
      return;
    }
    const lines = block.split('\n');
    if (lines.every((l) => l.startsWith('- '))) {
      out.push(
        <ul key={i} className="mt-6 space-y-3 border-s-2 border-ink/15 ps-5">
          {lines.map((l, j) => (
            <li
              key={j}
              className="relative text-lead before:absolute before:-start-[27px] before:top-[0.7em] before:size-2 before:rounded-full before:bg-paprika-deep before:content-['']"
            >
              {l.slice(2)}
            </li>
          ))}
        </ul>,
      );
      return;
    }
    out.push(
      <p key={i} className="mt-6 text-lead first:mt-0">
        {lines.join(' ')}
      </p>,
    );
  });
  return <div className="max-w-[38rem]">{out}</div>;
}
