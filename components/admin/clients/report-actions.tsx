'use client';

/** Print / close above the report sheet (never printed). */
export function ReportActions({
  printLabel,
  closeLabel,
  backHref,
}: {
  printLabel: string;
  closeLabel: string;
  /** where to go when the tab cannot close itself (opened directly) */
  backHref: string;
}) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
      <button
        type="button"
        onClick={() => {
          window.close();
          // still here: this tab was not opened from the panel
          setTimeout(() => window.location.assign(backHref), 150);
        }}
        className="inline-flex h-10 items-center rounded-[10px] border border-[#0f1b17]/20 bg-white px-4 text-[0.875rem] font-semibold text-[#0f1b17] hover:bg-[#f3f1ea]"
      >
        {closeLabel}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#0f1b17] px-4 text-[0.875rem] font-semibold text-white hover:opacity-90"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
        </svg>
        {printLabel}
      </button>
    </div>
  );
}
