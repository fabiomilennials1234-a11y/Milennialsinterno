// Slice 8 (#84) — página do board "Monday" agregado. Casca fina: monta o layout
// padrão do app e delega ao módulo `painel` (importado SÓ pelo barrel, ADR 0004).
//
// Acesso (decisão de arquitetura #84): qualquer usuário AUTENTICADO acessa a rota;
// os DADOS são auto-escopados pela RPC (audiência herdada, pode_ver_cliente). Quem
// não acompanha nenhum cliente vê o estado vazio — NÃO criamos uma 5ª visibilidade
// nem um page-grant novo (o briefing proíbe inventar visibilidade; a fonte única é
// pode_ver_cliente). Por isso ProtectedRoute, não PageAccessRoute.

import MainLayout from "@/layouts/MainLayout";
import { PainelDemandas } from "@/modules/painel";

export default function PainelDemandasPage() {
  return (
    <MainLayout>
      <PainelDemandas />
    </MainLayout>
  );
}
