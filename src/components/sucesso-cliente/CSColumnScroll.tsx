import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CSColumnScrollProps {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * Scroll nativo (sem Radix) com gutter estável para evitar que a scrollbar
 * sobreponha o conteúdo e “corte” a borda direita dos cards.
 */
export default function CSColumnScroll({ className, contentClassName, children }: CSColumnScrollProps) {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-apple",
        className,
      )}
      // scrollbarGutter ainda não tem typing em algumas versões do React/TS
      style={{ scrollbarGutter: "stable" } as any}
    >
      {/*
        IMPORTANT: coloque o gutter DEPOIS do contentClassName.
        Caso contrário, classes como p-4/px-4 sobrescrevem pr-* e o corte volta.
      */}
      <div className={cn(contentClassName, "pr-6")}>{children}</div>
    </div>
  );
}
