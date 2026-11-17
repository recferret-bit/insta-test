import { Monitor, Moon, Sun } from "lucide-react";

import {
  nextThemePreference,
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from "../../state/theme";
import { Icon } from "../components/Icon";

const META: Record<ThemePreference, { label: string; icon: typeof Sun }> = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
};

/** Manual theme toggle (F-FE-11): cycles light → dark → system. */
export function ThemeToggle({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  const pref = useThemePreference();
  const next = nextThemePreference(pref);
  const { label, icon } = META[pref];
  return (
    <button
      type="button"
      className={["theme-toggle", className].filter(Boolean).join(" ")}
      onClick={() => setThemePreference(next)}
      aria-label={`Theme: ${label}. Switch to ${META[next].label.toLowerCase()}`}
      title={`Theme: ${label}`}
    >
      <Icon icon={icon} size={24} />
      {showLabel ? (
        <span className="nav-label" aria-hidden="true">
          {label} theme
        </span>
      ) : null}
    </button>
  );
}
