import { useState } from "react";
import { cn } from "@/lib/utils";

/** Card-style section with a title header — used by Settings and Profile.
 *  When `collapsible` is true, the section can be toggled open/closed.
 *  Defaults to open unless `defaultOpen` is explicitly false. */
export function Section({
  title,
  children,
  titleClassName,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  titleClassName?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = !collapsible || open;
  const panelId = collapsible
    ? `section-panel-${title.toLowerCase().replace(/\s+/g, "-")}`
    : undefined;
  const buttonId = collapsible
    ? `section-btn-${title.toLowerCase().replace(/\s+/g, "-")}`
    : undefined;

  return (
    <div className="space-y-1">
      {collapsible ? (
        <h2 className="mb-2">
          <button
            type="button"
            id={buttonId}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={isOpen}
            aria-controls={panelId}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
            className="flex w-full items-center justify-between px-1 min-h-[44px] group"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  titleClassName ?? "text-neutral-500",
                )}
              >
                {title}
              </span>
              {!isOpen && (
                <span className="text-[10px] text-neutral-600 font-normal normal-case tracking-normal">
                  tap to expand
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-xs text-neutral-500 transition-transform duration-200",
                isOpen ? "" : "-rotate-90",
              )}
            >
              &#9660;
            </span>
          </button>
        </h2>
      ) : (
        <h2
          className={cn(
            "text-xs font-semibold uppercase tracking-wide px-1 mb-2",
            titleClassName ?? "text-neutral-500",
          )}
        >
          {title}
        </h2>
      )}
      {isOpen && (
        <div
          id={panelId}
          role={collapsible ? "region" : undefined}
          aria-labelledby={buttonId}
          className="rounded-lg border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Label + content row inside a Section. */
export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-neutral-200">{label}</span>
      {children}
    </div>
  );
}

/** Minimal labeled text input for forms. */
export function FormInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1 px-4">
      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-800 text-neutral-200 border border-neutral-700 outline-none focus:border-neutral-500 transition"
      />
    </div>
  );
}

/** Inline success or error message. */
export function StatusMessage({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (error) return <p className="text-xs text-red-400 px-4">{error}</p>;
  if (success) return <p className="text-xs text-green-400 px-4">{success}</p>;
  return null;
}
