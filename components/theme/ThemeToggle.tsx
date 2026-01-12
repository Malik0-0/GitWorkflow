"use client";

import { useContext } from "react";
import { ThemeContext } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button
      style={{ position: "relative" }}
      onClick={toggleTheme}
      className="px-3 py-2 rounded"
    >
      {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
    </button>
  );
}