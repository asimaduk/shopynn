import { useEffect } from "react";

/** After navigating to `/` with a hash, scroll the target section into view. */
export function useScrollToHash() {
  useEffect(() => {
    const scroll = () => {
      const { hash } = window.location;
      if (!hash) return;
      const id = hash.replace(/^#/, "");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, []);
}
