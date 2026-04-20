// Skeleton discreto exibido durante hidratação de sessão e code-splitting.
// Spinner centralizado com tipografia secundária — evita flash branco.
export default function AppBootSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3" aria-label="Carregando">
        <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <span className="text-[12px] text-muted-foreground">Carregando…</span>
      </div>
    </div>
  );
}
