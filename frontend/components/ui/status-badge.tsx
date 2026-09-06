import {
  Check,
  CircleDashed,
  CircleAlert,
  Loader2,
  Send,
  Timer,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline" | "info";

function StatusBadge({
  icon,
  label,
  variant,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  variant: BadgeVariant;
  pulse?: boolean;
}) {
  return (
    <Badge variant={variant}>
      {pulse ? <Loader2 className="size-3 animate-spin" aria-hidden /> : icon}
      {label}
    </Badge>
  );
}

// -------------------------------
// Video processing statuses
// -------------------------------

export function VideoStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "completed")
    return <StatusBadge icon={<Check className="size-3" />} label="Completed" variant="success" />;
  if (s === "failed")
    return <StatusBadge icon={<CircleAlert className="size-3" />} label="Failed" variant="destructive" />;
  if (s === "processing")
    return <StatusBadge icon={<Loader2 className="size-3 animate-spin" />} label="Processing" variant="warning" pulse />;
  return <StatusBadge icon={<Timer className="size-3" />} label="Queued" variant="secondary" />;
}

// -------------------------------
// Clip rendering statuses
// -------------------------------

export function ClipStatusBadge({ status, renderReady }: { status: string; renderReady?: boolean }) {
  if (renderReady)
    return <StatusBadge icon={<Check className="size-3" />} label="Ready" variant="success" />;
  const s = status.toLowerCase();
  if (s === "failed")
    return <StatusBadge icon={<CircleAlert className="size-3" />} label="Failed" variant="destructive" />;
  if (s === "rendering")
    return <StatusBadge icon={<Loader2 className="size-3 animate-spin" />} label="Rendering" variant="warning" pulse />;
  return <StatusBadge icon={<CircleDashed className="size-3" />} label="Draft" variant="secondary" />;
}

// -------------------------------
// Publishing statuses
// -------------------------------

export function PublishingStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "published")
    return <StatusBadge icon={<Check className="size-3.5" />} label="Published" variant="success" />;
  if (s === "failed")
    return <StatusBadge icon={<CircleAlert className="size-3.5" />} label="Failed" variant="destructive" />;
  if (s === "queued")
    return <StatusBadge icon={<Timer className="size-3.5" />} label="Queued" variant="secondary" />;
  if (s === "uploading")
    return <StatusBadge icon={<Upload className="size-3.5" />} label="Uploading" variant="info" />;
  return <StatusBadge icon={<Send className="size-3.5" />} label="Publishing" variant="info" />;
}