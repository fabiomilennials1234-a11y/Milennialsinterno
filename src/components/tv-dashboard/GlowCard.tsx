"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowDisabled?: boolean;
}

export function GlowCard({ children, className, glowDisabled = false }: GlowCardProps) {
  return (
    <div className={cn(
      "relative rounded-xl border-[0.5px] border-[#FFD400]/10 p-1",
      className
    )}>
      <GlowingEffect
        spread={30}
        glow={true}
        disabled={glowDisabled}
        proximity={48}
        inactiveZone={0.01}
        borderWidth={1}
      />
      <div className="relative h-full flex flex-col overflow-hidden rounded-lg border-[0.5px] border-[#FFD400]/5 bg-[#2a2320]/80 backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}

interface GlowCardHeaderProps {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  color?: string;
}

export function GlowCardHeader({ icon, title, badge, color = "text-[#FFD400]" }: GlowCardHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#FFD400]/5">
      <div className={cn(
        "w-5 h-5 rounded-md flex items-center justify-center",
        "bg-gradient-to-br from-[#FFD400]/20 to-[#FFD400]/5"
      )}>
        <span className={color}>{icon}</span>
      </div>
      <h3 className={cn("font-bold text-[10px] uppercase tracking-wide", color)}>
        {title}
      </h3>
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
  );
}

export function GlowCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex-1 p-1.5", className)}>
      {children}
    </div>
  );
}
