import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

export function useThemePreference(
  storageKey: string = "tb_theme",
  defaultTheme: Theme = "dark"
) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    const saved = (localStorage.getItem(storageKey) as Theme | null) ?? defaultTheme;
    setTheme(saved);
  }, [storageKey, defaultTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  return { theme, setTheme };
}
