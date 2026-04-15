export type Tier = "free" | "pro";

export interface Capabilities {
  tier: Tier;
  canAccessFlow: boolean;
  canAccessOdds: boolean;
  canAccessTimeline: boolean;
  canAccessStats: boolean;
  canAccessWrapUp: boolean;
  canPinGames: boolean;
  dailyRevealLimit: number;
  dailyFlowLimit: number;
}

export type CapabilityKey = {
  [K in keyof Capabilities]: Capabilities[K] extends boolean ? K : never;
}[keyof Capabilities];

export const TIER_CAPABILITIES: Record<Tier, Capabilities> = {
  free: {
    tier: "free",
    canAccessFlow: true,
    canAccessOdds: false,
    canAccessTimeline: true,
    canAccessStats: true,
    canAccessWrapUp: true,
    canPinGames: false,
    dailyRevealLimit: 5,
    dailyFlowLimit: 3,
  },
  pro: {
    tier: "pro",
    canAccessFlow: true,
    canAccessOdds: true,
    canAccessTimeline: true,
    canAccessStats: true,
    canAccessWrapUp: true,
    canPinGames: true,
    dailyRevealLimit: Infinity,
    dailyFlowLimit: Infinity,
  },
};
