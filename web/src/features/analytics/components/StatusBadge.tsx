const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-900/50 text-green-400",
  running: "bg-blue-900/50 text-blue-400",
  pending: "bg-yellow-900/50 text-yellow-400",
  failed: "bg-red-900/50 text-red-400",
  cancelled: "bg-neutral-800 text-neutral-500",
  promoted: "bg-purple-900/50 text-purple-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? "bg-neutral-800 text-neutral-400"}`}>
      {status}
    </span>
  );
}
