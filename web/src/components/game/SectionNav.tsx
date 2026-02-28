"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SectionNavProps {
  sections: string[];
  active: string;
  onSelect: (section: string) => void;
}

export function SectionNav({ sections, active, onSelect }: SectionNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Auto-scroll the active tab into view within the scrollable nav
  useEffect(() => {
    const activeBtn = buttonRefs.current[active];
    if (activeBtn && navRef.current) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [active]);

  const handleSelect = (section: string) => {
    onSelect(section);

    // Scroll to the corresponding section element in the page
    const sectionEl = document.getElementById(`section-${section}`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="sticky top-14 z-30 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div
        ref={navRef}
        className="flex overflow-x-auto scrollbar-none px-4 gap-1"
      >
        {sections.map((section) => (
          <button
            key={section}
            ref={(el) => { buttonRefs.current[section] = el; }}
            onClick={() => handleSelect(section)}
            className={cn(
              "shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
              active === section
                ? "border-neutral-50 text-neutral-50"
                : "border-transparent text-neutral-500 hover:text-neutral-300",
            )}
          >
            {section}
          </button>
        ))}
      </div>
    </div>
  );
}
