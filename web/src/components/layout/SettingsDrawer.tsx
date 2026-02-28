"use client";

import { useEffect } from "react";
import { useUI } from "@/stores/ui";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { cn } from "@/lib/utils";

export function SettingsDrawer() {
  const { settingsOpen, closeSettings } = useUI();

  // Lock body scroll when open
  useEffect(() => {
    if (settingsOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [settingsOpen]);

  // Close on Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [settingsOpen, closeSettings]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          settingsOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={closeSettings}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md",
          "bg-neutral-950 border-l border-neutral-800 shadow-2xl",
          "transform transition-transform duration-200 ease-out",
          settingsOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-800">
          <h1 className="text-lg font-bold text-neutral-100">Settings</h1>
          <button
            onClick={closeSettings}
            className="text-neutral-500 hover:text-neutral-200 transition-colors text-xl leading-none p-1"
          >
            &#10005;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto h-[calc(100%-57px)] px-4 py-6 pb-24">
          <SettingsContent />
        </div>
      </div>
    </>
  );
}
