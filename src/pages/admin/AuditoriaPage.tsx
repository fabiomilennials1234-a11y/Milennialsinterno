import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_role: string;
  page_slug: string;
  grant_source: 'role_default' | 'page_grant' | 'admin_bypass';
  accessed_at: string;
}

interface AuditPayload {
  rows: AuditRow[];
  total: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

const SOURCE_LABEL: Record<AuditRow['grant_source'], string> = {
  role_default: 'Default do cargo',
  page_grant:   'Grant explícito',
  admin_bypass: 'Admin bypass',
};

const SOURCE_BADGE: Record<AuditRow['grant_source'], string> = {
  role_default: 'bg-muted text-muted-foreground',
  page_grant:   'bg-primary/15 text-primary',
  admin_bypass: 'bg-warning/15 text-warning',
};

export default function AuditoriaPage() {
  const [pageFilter, setPageFilter]   = useState('');
  const [sinceDays, setSinceDays]     = useState<number>(7);

  const { data, isLoading, error } = useQuery<AuditPayload>({
    queryKey: ['admin-page-access-audit', pageFilter, sinceDays],
    queryFn: async () => {
      const since = sinceDays > 0
        ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const { data: payload, error: err } = await sb.rpc('get_page_access_audit', {
        _user_id:   null,
        _page_slug: pageFilter || null,
        _since:     since,
        _limit:     500,
      });
      if (err) throw err;
      return payload as AuditPayload;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Auditoria de Acessos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de quem acessou cada página, com cargo e origem do grant.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Filtrar por page_slug</label>
            <input
              type="text"
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              placeholder="ex: design"
              className="input-apple w-56"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Janela</label>
            <select
              value={sinceDays}
              onChange={(e) => setSinceDays(Number(e.target.value))}
              className="input-apple w-44"
            >
              <option value={1}>Últimas 24h</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={0}>Tudo</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            Falha ao carregar auditoria: {(error as Error).message}
          </div>
        )}

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhum acesso registrado no período.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Quando</th>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">Cargo</th>
                  <th className="text-left p-3">Página</th>
                  <th className="text-left p-3">Origem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.accessed_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      {r.user_name ?? r.user_id}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{r.user_role}</td>
                    <td className="p-3 text-xs font-mono">{r.page_slug}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${SOURCE_BADGE[r.grant_source]}`}>
                        {SOURCE_LABEL[r.grant_source]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 text-xs text-muted-foreground bg-muted/20 border-t border-border">
              {rows.length} registro{rows.length === 1 ? '' : 's'} (limite 500)
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
