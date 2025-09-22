"use client";
import { useEffect } from "react";

export function GlobalGuards() {
  useEffect(() => {
    const onClick = (e: Event) => {
      const el = e.target as Element | null;
      const btn = el?.closest?.('button, [role="button"]');
      if (btn && !btn.hasAttribute("data-allow-click")) {
        // e.preventDefault();
        // e.stopImmediatePropagation();
      }
    };
    const onSubmit = (e: Event) => {
      const form = e.target as Element | null;
      if (form && !form.hasAttribute("data-allow-submit")) {
        // e.preventDefault();
        // e.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
  return null;
}
