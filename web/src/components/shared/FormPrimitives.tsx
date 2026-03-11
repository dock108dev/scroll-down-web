import { cn } from "@/lib/utils";

/** Card-style section with a title header — used by Settings and Profile. */
export function Section({
  title,
  children,
  titleClassName,
}: {
  title: string;
  children: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="space-y-1">
      <h2
        className={cn(
          "text-xs font-semibold uppercase tracking-wide px-1 mb-2",
          titleClassName ?? "text-neutral-500",
        )}
      >
        {title}
      </h2>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
        {children}
      </div>
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
