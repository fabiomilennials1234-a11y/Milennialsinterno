import {
  extractJSON,
  parseOracleGroupJSON,
  parseOracleIndividualJSON,
} from "@/lib/oracle-utils";
import { OracleGroupView } from "./OracleGroupView";
import { OracleIndividualView } from "./OracleIndividualView";

function LegacyContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-2.5" />;
        }
        if (
          /^[A-ZÁÀÃÉÊÍÓÔÚÇ\s]{4,}[:]?$/.test(trimmed) ||
          /^\d+\.\s+[A-ZÁÀÃÉÊÍÓÔÚÇ]/.test(trimmed)
        ) {
          return (
            <h4
              key={i}
              className="text-[11px] font-semibold text-foreground/90 uppercase tracking-widest mt-3 mb-1 first:mt-0"
            >
              {trimmed.replace(/^\d+\.\s*/, "")}
            </h4>
          );
        }
        if (
          trimmed.startsWith("•") ||
          trimmed.startsWith("-") ||
          trimmed.startsWith("*")
        ) {
          return (
            <p
              key={i}
              className="text-xs text-muted-foreground/80 pl-2.5 py-0.5 leading-relaxed border-l border-subtle/30"
            >
              {trimmed.replace(/^[•\-*]\s*/, "")}
            </p>
          );
        }
        return (
          <p
            key={i}
            className="text-xs text-muted-foreground/70 leading-relaxed py-0.5"
          >
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

interface OracleContentRouterProps {
  content: string;
  type: "group" | "individual";
}

export function OracleContentRouter({ content, type }: OracleContentRouterProps) {
  const jsonStr = extractJSON(content);

  if (jsonStr) {
    if (type === "group") {
      const data = parseOracleGroupJSON(jsonStr);
      if (data) return <OracleGroupView data={data} />;
    } else {
      const data = parseOracleIndividualJSON(jsonStr);
      if (data) return <OracleIndividualView data={data} />;
    }
  }

  return <LegacyContent content={content} />;
}
