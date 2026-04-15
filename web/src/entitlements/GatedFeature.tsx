"use client";

import { useEntitlement } from "./useEntitlement";
import type { CapabilityKey } from "./capabilities";
import { UpgradePrompt } from "./UpgradePrompt";

export function GatedFeature({
  capability,
  message,
  preview,
  children,
  onUpgradeRequest,
}: {
  capability: CapabilityKey;
  message?: string;
  preview?: React.ReactNode;
  children: React.ReactNode;
  onUpgradeRequest?: () => void;
}) {
  const capabilities = useEntitlement();

  if (capabilities[capability]) {
    return <>{children}</>;
  }

  return (
    <UpgradePrompt
      feature={capability}
      message={message}
      preview={preview}
      onUpgradeRequest={onUpgradeRequest}
    />
  );
}
