/** Controlled collapsible section with anchor ID for scroll tracking. */
export function CollapsibleSection({
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={`section-${title}`} className="scroll-mt-24" style={{ scrollMarginTop: "calc(var(--header-h) + 40px)" }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-neutral-200 hover:bg-neutral-800/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
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
