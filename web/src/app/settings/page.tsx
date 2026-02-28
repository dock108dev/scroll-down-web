"use client";

import { SettingsContent } from "@/components/settings/SettingsContent";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-neutral-100">Settings</h1>
      <SettingsContent />
    </div>
  );
}
