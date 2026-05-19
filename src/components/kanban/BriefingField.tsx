import { ExternalLink } from 'lucide-react';

export function RichTextWithLinks({ text }: { text: string }) {
  const splitRegex = /(https?:\/\/[^\s,<>""'']+)/gi;
  const testRegex = /^https?:\/\//i;
  const parts = text.split(splitRegex);

  return (
    <span className="text-sm text-foreground whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        testRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline break-all"
          >
            {part}
            <ExternalLink size={11} className="shrink-0" />
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function BriefingField({
  label,
  value,
  isLink = false,
  isText = false
}: {
  label: string;
  value: string | null;
  isLink?: boolean;
  isText?: boolean;
}) {
  if (!value) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        <p className="text-sm text-muted-foreground/50 italic">Não informado</p>
      </div>
    );
  }

  const isPureUrl = /^https?:\/\/[^\s]+$/.test(value.trim());

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {isLink && isPureUrl ? (
        <a
          href={value.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline break-all"
        >
          {value.trim()}
          <ExternalLink size={12} className="shrink-0" />
        </a>
      ) : isLink && !isPureUrl ? (
        <RichTextWithLinks text={value} />
      ) : isText ? (
        <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-foreground">{value}</p>
      )}
    </div>
  );
}
