# PRD — Banco de Info Unificado do Cliente

**Status:** ready-for-agent
**Data:** 2026-05-26
**Autor:** Fundador + Claude

---

## Problem Statement

Hoje o sistema mantém 3 bancos de informações de cliente separados — um para Design, um para Dev e um para Editor de Vídeo — cada um com sua própria tabela, hooks, componentes e formulários. Isso causa:

1. **Fragmentação**: mesma informação (ex: instagram, website) duplicada em tabelas diferentes, podendo divergir
2. **Retrabalho**: GP coleta informações na Call 1 mas não tem onde centralizar — departamentos preenchem independentemente
3. **Falta de cross-pollination**: Designer não vê plataforma CMS do cliente, Dev não vê estilo visual preferido
4. **Sem gate de qualidade**: GP pode avançar cliente no onboarding sem coletar informações básicas

## Solution

Unificar os 3 bancos de informação numa tabela e componente únicos (`client_info_bank`), com formulário organizado por seções temáticas. Criar subtarefa bloqueante "Preencher banco de info do cliente" no step `realizar_call_1` do GP. Todos os departamentos passam a ler/escrever no mesmo banco, com visibilidade total dos campos organizados por seções.

## User Stories

1. Como GP, quero preencher um formulário único de informações do cliente durante a Call 1, para que todos os departamentos tenham contexto desde o início
2. Como GP, quero que o sistema me impeça de avançar o cliente sem preencher o banco de info, para que nenhum cliente passe sem informações coletadas
3. Como GP, quero ver a subtarefa "Preencher banco de info" dentro do step Realizar Call 1, para saber que preciso fazer isso durante a ligação
4. Como GP, quero que o formulário tenha seções claras (Marca, Presença Digital, Vídeo, Dev, Geral), para organizar a conversa com o cliente
5. Como GP, quero que todos os campos sejam opcionais, para poder salvar mesmo quando o cliente não tem todas as informações (ex: não tem YouTube)
6. Como Designer, quero ver todas as informações do cliente num lugar só, incluindo presença digital e referências visuais, para ter contexto completo ao criar
7. Como Dev, quero ver estilo visual e presença digital do cliente além dos campos técnicos, para entender melhor o projeto
8. Como Editor de Vídeo, quero ver cores da marca e estilo visual do cliente, para manter consistência visual nos vídeos
9. Como qualquer membro do time, quero poder editar o banco de info do cliente, para manter informações atualizadas conforme descubro coisas novas
10. Como qualquer membro do time, quero ver o banco de info organizado por seções temáticas, para encontrar rapidamente a informação que preciso
11. Como sistema, quero migrar dados dos 3 perfis existentes (design, dev, video) para a tabela unificada, para não perder informações já cadastradas
12. Como sistema, quero que o gate bloqueante verifique se o formulário foi salvo (não se campos estão preenchidos), para balancear completude com flexibilidade

## Implementation Decisions

### Nova tabela `client_info_bank`

Tabela única com todos os campos, organizados por seção:

**Seção Marca:**
- `brand_colors` (text) — Cores da marca
- `typography` (text) — Tipografia
- `visual_style` (text) — Estilo visual / referências
- `brand_manual_url` (text) — URL manual de marca
- `logo_url` (text) — URL logo

**Seção Presença Digital:**
- `website_url` (text) — Website
- `instagram_handle` (text) — Instagram
- `youtube_channel` (text) — YouTube
- `tiktok_handle` (text) — TikTok
- `domain` (text) — Domínio

**Seção Vídeo:**
- `editing_style` (text) — Estilo de edição preferido
- `video_formats` (text) — Formatos (Reels, YouTube, Stories, TikTok)

**Seção Dev:**
- `cms_platform` (text) — CMS/plataforma atual
- `figma_url` (text) — URL do Figma

**Seção Geral:**
- `notes` (text) — Notas livres

**Campos de controle:**
- `id` (uuid, PK)
- `client_id` (uuid, FK → clients.id, UNIQUE)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `created_by` (uuid, FK → auth.users)
- `updated_by` (uuid, FK → auth.users)

### RPC `upsert_client_info_bank`

Segue padrão existente dos 3 RPCs de perfil. Recebe `p_client_id` + todos os campos como parâmetros opcionais. Faz INSERT ON CONFLICT (client_id) DO UPDATE. Retorna o id do registro.

### Gate bloqueante no GP

Modificar a RPC `growth_advance_gp_step` para bloquear transição `realizar_call_1 → escolher_equipe` se não existir registro em `client_info_bank` para o `client_id`. Erro: `'Banco de info do cliente deve ser preenchido antes de avançar'`.

No frontend, o botão "Avançar para Escolher Equipe" fica desabilitado se não existe registro no banco de info. Mostra tooltip/label explicando o bloqueio.

### Subtarefa no GP

Dentro do step `realizar_call_1` na `NovosClientesOnboardingSection`, adicionar botão/card "Preencher banco de info do cliente" que:
- Mostra status (preenchido / não preenchido)
- Abre o `ClientInfoBankModal` ao clicar
- Ícone de check quando já salvou

### Componente unificado `ClientInfoBankModal`

Segue padrão existente do `ClientDesignProfileModal`:
- useState para form state (sem react-hook-form)
- Campos definidos como array FIELDS com key, label, type, placeholder, icon, seção
- `emptyToNull()` para converter strings vazias
- ScrollArea para body
- Seções renderizadas como headers visuais dentro do form

### Componente `ClientInfoBankTab`

Substitui os 3 componentes de tab existentes (`DesignClientInfoTab`, `DevsClientInfoTab`, `VideoClientInfoTab`). Mesmo padrão visual:
- Search bar para filtrar clientes
- Grid de cards (com perfil / sem perfil)
- Campos agrupados por seções temáticas
- Botão Cadastrar/Editar abre o modal unificado

### Migração de dados

Script SQL que:
1. Cria tabela `client_info_bank`
2. Insere dados merged dos 3 perfis existentes:
   - Campos exclusivos: copia direto
   - Campos duplicados (instagram, website): prioriza o mais recentemente atualizado
   - `created_by` / `updated_by`: usa o do perfil mais recente
3. Cria RPC `upsert_client_info_bank`
4. Cria RLS policies (mesma lógica dos perfis existentes)
5. NÃO dropa tabelas antigas imediatamente — deprecia com comentário, remove em migration futura

### Atualização dos departamentos

- `DesignPage.tsx`: aba "Banco de Info" → usa `ClientInfoBankTab`
- `DevsPage.tsx`: aba "Banco de Info" → usa `ClientInfoBankTab`
- `EditorVideoPage.tsx`: aba "Banco de Info" → usa `ClientInfoBankTab`
- Hooks antigos (`useClientDesignProfiles`, etc.) mantidos temporariamente, marcados deprecated

### Hook unificado `useClientInfoBank`

- `useClientInfoBanks()` — lista todos perfis (query key: `['client-info-bank']`)
- `useClientInfoBank(clientId)` — perfil único (query key: `['client-info-bank', clientId]`)
- `useUpsertClientInfoBank()` — mutation de upsert
- Stale time: 2 minutos (mesmo padrão existente)

## Testing Decisions

Bons testes verificam comportamento externo observável, não implementação interna. Testar o que o usuário vê e o que o sistema garante.

### Módulos a testar

1. **RPC `upsert_client_info_bank`** (pgTAP)
   - Insert novo perfil
   - Update perfil existente (upsert)
   - Todos campos nullable
   - `updated_at` e `updated_by` atualizados no update

2. **Gate bloqueante na RPC `growth_advance_gp_step`** (pgTAP)
   - Bloqueia `realizar_call_1 → escolher_equipe` sem registro em `client_info_bank`
   - Permite transição quando registro existe
   - Outras transições não afetadas

3. **Migration de dados** (pgTAP)
   - Dados dos 3 perfis migrados corretamente
   - Campos duplicados resolvidos pelo mais recente
   - Clientes sem perfil não geram registro

4. **RLS policies** (pgTAP)
   - Authenticated users podem ler
   - Authenticated users podem inserir/atualizar

### Prior art
- Testes pgTAP existentes no projeto para RPCs similares
- Padrão de teste de upsert nos perfis existentes

## Out of Scope

- **Histórico de edições / auditoria** — adicionar quando/se necessário no futuro
- **Campos técnicos detalhados** (stack frontend, CSS framework, hosting, analytics ID, resolução de vídeo) — departamentos preenchem direto se precisarem, fora deste formulário
- **Controle de acesso por campo/departamento** — qualquer membro autenticado edita tudo
- **Drop das tabelas antigas** — feito em migration futura após validação. Esta PRD só deprecia
- **Campos obrigatórios no formulário** — todos opcionais, gate é existência do registro
- **Notificações** — não notifica departamentos quando banco de info é preenchido/atualizado

## Further Notes

- A tabela `client_info_bank` é extensível — novos campos podem ser adicionados conforme necessidade sem afetar a estrutura
- O formulário unificado é o mesmo componente em todos os contextos (GP, Design, Dev, Video) — zero variação
- Ordem de implementação sugerida: (1) tabela + RPC + migration, (2) hook + modal, (3) integração GP com gate, (4) swap tabs nos departamentos
- O plano existente `2026-05-11-designer-client-info-bank.md` é superseded por este — era específico pra design, agora unificamos
