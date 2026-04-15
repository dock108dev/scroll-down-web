"use client";

import type { ReactNode } from "react";
import { useSpoilerGate } from "@/hooks/useSpoilerGate";
import type { SpoilerGateResult } from "@/hooks/useSpoilerGate";

interface SpoilerGateProps {
  gameId: number;
  children: (gate: SpoilerGateResult) => ReactNode;
  fallback?: ReactNode;
}

export function SpoilerGate({ gameId, children, fallback = null }: SpoilerGateProps) {
  const gate = useSpoilerGate(gameId);
  if (!gate) return <>{fallback}</>;
  return <>{children(gate)}</>;
}
