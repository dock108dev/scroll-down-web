import { create } from "zustand";
import type { FeatureGateKey } from "@/lib/config";

interface ProGateSheetState {
  open: boolean;
  feature: FeatureGateKey | null;
  triggerEl: HTMLElement | null;
  openSheet: (feature: FeatureGateKey, triggerEl?: HTMLElement | null) => void;
  closeSheet: () => void;
}

export const useProGateSheet = create<ProGateSheetState>()((set) => ({
  open: false,
  feature: null,
  triggerEl: null,
  openSheet: (feature, triggerEl = null) => set({ open: true, feature, triggerEl }),
  closeSheet: () => set({ open: false }),
}));
