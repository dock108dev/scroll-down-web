"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface InlineFeedbackProps {
  context: string;
}

export function InlineFeedback({ context }: InlineFeedbackProps) {
  const [voted, setVoted] = useState<"up" | "down" | null>(null);

  if (voted) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-neutral-500">
        Thanks for the feedback!
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <span className="text-xs text-neutral-500">Was this useful?</span>
      <button
        onClick={() => {
          setVoted("up");
          trackEvent("feedback_up", { context });
        }}
        className="px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-lg bg-neutral-800 text-neutral-400 hover:text-green-400 hover:bg-neutral-700 transition text-sm"
        aria-label="Yes, this was useful"
      >
        +1
      </button>
      <button
        onClick={() => {
          setVoted("down");
          trackEvent("feedback_down", { context });
        }}
        className="px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400 hover:bg-neutral-700 transition text-sm"
        aria-label="No, this was not useful"
      >
        -1
      </button>
    </div>
  );
}
