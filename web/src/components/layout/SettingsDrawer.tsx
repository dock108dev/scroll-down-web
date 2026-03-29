"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useUI } from "@/stores/ui";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { cn } from "@/lib/utils";

// Tiny external store that stays `true` while the drawer is open and for 220ms
// after it closes, so the slide-out CSS transition can finish before unmounting.
let _mounted = false;
let _timer: ReturnType<typeof setTimeout> | null = null;
const _listeners = new Set<() => void>();
function notify() { _listeners.forEach((l) => l()); }
function setMounted(open: boolean) {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  if (open) {
    _mounted = true;
    notify();
  } else {
    _timer = setTimeout(() => { _mounted = false; notify(); }, 220);
  }
}
function subscribeMounted(cb: () => void) { _listeners.add(cb); return () => { _listeners.delete(cb); }; }
function getMounted() { return _mounted; }

export function SettingsDrawer() {
  const { settingsOpen, closeSettings } = useUI();

  // Keep the drawer mounted briefly after close so the slide-out animation plays
  const mounted = useSyncExternalStore(subscribeMounted, getMounted, getMounted);
  useEffect(() => { setMounted(settingsOpen); }, [settingsOpen]);

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

  if (!mounted && !settingsOpen) return null;

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
        inert={!settingsOpen || undefined}
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md",
          "bg-neutral-950 border-l border-neutral-800 shadow-2xl",
          "transform transition-transform duration-200 ease-out",
          settingsOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-100">Settings</h2>
          <button
            onClick={closeSettings}
            className="text-neutral-500 hover:text-neutral-200 transition-colors text-xl leading-none p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            &#10005;
          </button>
        </div>

        {/* Scrollable content — only mount when open to avoid duplicate DOM nodes with /settings page */}
        <div className="overflow-y-auto h-[calc(100%-57px)] px-4 py-6 pb-24">
          {settingsOpen && <SettingsContent />}
        </div>
      </div>
    </>
  );
}
