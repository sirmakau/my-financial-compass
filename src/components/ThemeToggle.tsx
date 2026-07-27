import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";

const order: ThemePreference[] = ["system", "light", "dark"];
const meta = {
  system: { icon: Monitor, label: "Theme: device default" },
  light: { icon: Sun, label: "Theme: light" },
  dark: { icon: Moon, label: "Theme: dark" },
} as const;

export const ThemeToggle = () => {
  const { preference, setPreference } = useTheme();
  const { icon: Icon, label } = meta[preference];

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      title={label}
      aria-label={label}
      onClick={() => setPreference(order[(order.indexOf(preference) + 1) % order.length])}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
};
