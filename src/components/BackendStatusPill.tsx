import { useBackendStatus } from "@/hooks/useBackendStatus";
import { useOutboxFlusher } from "@/hooks/useOutboxFlusher";
import { Cloud, CloudOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const BackendStatusPill = () => {
  const status = useBackendStatus();
  const { pending, flushing, flush } = useOutboxFlusher();

  const isOffline = status === "offline" || status === "degraded";
  const label = flushing
    ? `Syncing…`
    : pending > 0
    ? `${pending} pending`
    : isOffline
    ? status === "offline" ? "Offline" : "Backend issue"
    : "Online";

  const Icon = flushing ? Loader2 : isOffline ? CloudOff : Cloud;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => flush()}
      disabled={flushing || (pending === 0 && !isOffline)}
      className={cn(
        "h-7 gap-1.5 rounded-full border px-2.5 text-[11px]",
        isOffline
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15"
          : pending > 0
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border/60 text-muted-foreground",
      )}
      title={pending > 0 ? "Click to retry sync" : label}
    >
      <Icon className={cn("h-3.5 w-3.5", flushing && "animate-spin")} />
      <span>{label}</span>
      {pending > 0 && !flushing && <RefreshCw className="h-3 w-3 opacity-70" />}
    </Button>
  );
};
