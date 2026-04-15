"use client";

import { useContext } from "react";
import { EntitlementContext } from "./EntitlementProvider";
import type { Capabilities } from "./capabilities";

export function useEntitlement(): Capabilities {
  const ctx = useContext(EntitlementContext);
  return ctx.capabilities;
}
