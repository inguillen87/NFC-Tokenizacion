"use client";

import { useEffect } from "react";

// Sections that moved from the home to /platform keep their saved links working.
const MOVED_FRAGMENTS: Readonly<Record<string, string>> = {
  "#pasaporte-digital": "/platform#pasaporte-digital",
};

export function MovedFragmentRedirect() {
  useEffect(() => {
    const follow = () => {
      const target = MOVED_FRAGMENTS[window.location.hash];
      if (target) window.location.replace(target);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  return null;
}
