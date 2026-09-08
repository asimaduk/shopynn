import { createContext, useContext, useEffect } from "react";

type Theme = "light";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

/** Marketing site stays on a light, off-white surface. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    try {
      localStorage.setItem("theme", "light");
    } catch {
      /* ignore */
    }
  }, []);

  return <Ctx.Provider value={{ theme: "light", toggle: () => {} }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
