"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Whether <html> is dark right now; dark on the server, where every page starts. */
function isDark() {
  return typeof document === "undefined"
    ? true
    : document.documentElement.classList.contains("dark");
}

/**
 * Navbar button that switches between dark and light. Every page load starts dark; the
 * choice isn't saved, it lasts until the next reload.
 */
export function ThemeToggle() {
  // Read from <html>, not just `true`: after sign-out and sign-in the navbar mounts again
  // while <html> may still be light from earlier in this page load.
  const [dark, setDark] = useState(isDark);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
