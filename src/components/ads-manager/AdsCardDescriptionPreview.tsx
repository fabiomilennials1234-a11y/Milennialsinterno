import { cn } from "@/lib/utils";

interface AdsCardDescriptionPreviewProps {
  text?: string | null;
  className?: string;
  lines?: 1 | 2 | 3;
}

function normalizePreviewText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export default function AdsCardDescriptionPreview({
  text,
  className,
  lines = 2,
}: AdsCardDescriptionPreviewProps) {
  const normalized = text ? normalizePreviewText(text) : "";
  if (!normalized) return null;

  const clampClass = lines === 1 ? "line-clamp-1" : lines === 3 ? "line-clamp-3" : "line-clamp-2";

  return (
    <p
      className={cn(
        "mt-1.5 text-xs text-muted-foreground break-words whitespace-normal",
        clampClass,
        className,
      )}
      title={normalized}
    >
      {normalized}
    </p>
  );
}
