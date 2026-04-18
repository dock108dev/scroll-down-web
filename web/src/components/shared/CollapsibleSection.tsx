/** Controlled collapsible section with anchor ID for scroll tracking. */
export function CollapsibleSection({
  title,
  open,
  onToggle,
  badge,
  beta,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  /** When true, renders a (beta) badge and uses muted secondary styling to signal AI/experimental content. */
  beta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div id={`section-${title}`} className="scroll-mt-24" style={{ scrollMarginTop: "calc(var(--header-h) + 40px)" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
        className={`flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-neutral-800/30 transition-colors ${beta ? "font-normal text-neutral-400" : "font-semibold text-neutral-200"}`}
      >
        <span className="flex items-center gap-2">
          {title}
          {beta && (
            <span className="text-[10px] font-medium text-neutral-500 bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded-full leading-none">
              beta
            </span>
          )}
          {!open && badge}
        </span>
        <span
          className={`text-xs text-neutral-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        >
          &#9660;
        </span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}
