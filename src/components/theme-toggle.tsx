import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark", toggle: () => {},
});
// Like benches, appearance is kept within this session, without disk storage.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", theme === "dark" ? "#1b1e28" : "#f8fafc");
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme((old) => old === "dark" ? "light" : "dark") }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" className="theme-toggle" role="switch"
      aria-label="Dark mode" aria-checked={theme === "dark"}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={toggle}>
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </Button>
  );
}
