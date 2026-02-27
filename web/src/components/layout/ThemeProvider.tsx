"use client";

import { useEffect } from "react";
import { useSettings } from "@/stores/settings";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => {
        if (mq.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
  }, [theme]);

  return <>{children}</>;
}
