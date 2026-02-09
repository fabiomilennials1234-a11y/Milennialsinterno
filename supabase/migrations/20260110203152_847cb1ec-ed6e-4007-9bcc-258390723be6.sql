-- =====================================================
-- SISTEMA DE CLIENTES E GESTOR DE ADS
-- =====================================================

-- Tabela de Clientes
CREATE TABLE public.clients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    cpf TEXT,
    razao_social TEXT,
    general_info TEXT,
    expected_investment DECIMAL(12,2),
    group_id UUID REFERENCES public.organization_groups(id),
    squad_id UUID REFERENCES public.squads(id),
    assigned_ads_manager UUID, -- user_id do Gestor de Ads
    status TEXT DEFAULT 'new_client', -- new_client, onboarding, active, churned
    onboarding_started_at TIMESTAMP WITH TIME ZONE,
    campaign_published_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Formulário de Call do Cliente
CREATE TABLE public.client_call_forms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    apresentacao TEXT,
    motivo_call TEXT,
    historia_empresa TEXT,
    produto_servico TEXT,
    lista_produtos TEXT,
    cliente_ideal TEXT,
    dor_desejo TEXT,
    historico_marketing TEXT,
    site TEXT,
    comercial_existente TEXT,
    expectativas_30d TEXT,
    expectativas_3m TEXT,
    expectativas_6m TEXT,
    expectativas_1a TEXT,
    proposito TEXT,
    referencias TEXT,
    localizacao TEXT,
    acoes_pontuais TEXT,
    investimento TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Documentação Diária do Gestor de Ads
CREATE TABLE public.ads_daily_documentation (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ads_manager_id UUID NOT NULL, -- user_id do Gestor de Ads
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    documentation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    metrics TEXT,
    actions_done TEXT,
    client_budget TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Acompanhamento Diário de Clientes (posição por dia da semana)
CREATE TABLE public.client_daily_tracking (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    ads_manager_id UUID NOT NULL,
    current_day TEXT DEFAULT 'sexta', -- segunda, terca, quarta, quinta, sexta
    last_moved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_delayed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id)
);

-- Justificativas
CREATE TABLE public.ads_justifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    ads_manager_id UUID NOT NULL,
    reason TEXT NOT NULL,
    justification_type TEXT DEFAULT 'delay', -- delay, milestone_overdue, other
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Onboarding do Cliente (Marcos)
CREATE TABLE public.client_onboarding (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    current_milestone INTEGER DEFAULT 1, -- 1-5
    current_step TEXT DEFAULT 'boas_vindas',
    milestone_1_started_at TIMESTAMP WITH TIME ZONE,
    milestone_2_started_at TIMESTAMP WITH TIME ZONE,
    milestone_3_started_at TIMESTAMP WITH TIME ZONE,
    milestone_4_started_at TIMESTAMP WITH TIME ZONE,
    milestone_5_started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id)
);

-- Checklists de Marcos
CREATE TABLE public.onboarding_checklists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    milestone INTEGER NOT NULL,
    step TEXT NOT NULL,
    item TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tarefas do Gestor de Ads (Diárias e Semanais)
CREATE TABLE public.ads_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ads_manager_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT DEFAULT 'daily', -- daily, weekly
    status TEXT DEFAULT 'todo', -- todo, doing, done
    priority TEXT, -- urgente, prioridade, normal
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reuniões Semanais (criadas pelo Gestor de Projetos)
CREATE TABLE public.ads_meetings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ads_manager_id UUID NOT NULL, -- para qual Gestor de Ads
    title TEXT NOT NULL,
    description TEXT,
    meeting_date TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL, -- Gestor de Projetos que criou
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ferramentas PRO+ (Conteúdo Global editável só pelo CEO)
CREATE TABLE public.pro_tools (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    icon TEXT,
    content TEXT,
    link TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bônus e Lemas (Conteúdo Global editável só pelo CEO)
CREATE TABLE public.company_content (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE, -- 'bonus', 'lemas'
    title TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir Ferramentas PRO+ padrão
INSERT INTO public.pro_tools (slug, title, icon, position) VALUES
('estrategias', 'Estratégias Millennials', '📚', 1),
('gpt_roteiros', 'GPT Criador de Roteiros + Criador de LPS', '🤖', 2),
('swipe_file', 'Swipe File (Roteiros)', '🎬', 3),
('tipos_video', 'Tipos de Vídeo + Estático', '📺', 4),
('clientes_millennials', 'Clientes Millennials', '🎯', 5),
('treinamento', 'Treinamento gestor de sucesso', '🏆', 6),
('lista_marcos', 'Lista dos marcos', '🚩', 7),
('docs_copy', 'DOCS para envio de Copy estática Millennials', '📋', 8),
('docs_roteiros', 'DOCS para envio de Roteiros Millennials', '📄', 9),
('link_consultorias', 'Link Consultorias', '🔗', 10),
('drive_clientes', 'Drive Clientes', '📁', 11),
('relatorio_reportei', 'Relatório Reportei', '📊', 12),
('contas_millennials', 'Contas da Millennials', '💳', 13),
('automacao_crm', 'Como fazer Automação CRM dos Clientes', '📱', 14),
('acesso_cursos', 'Acesso Cursos', '🎓', 15);

-- Inserir conteúdo da empresa
INSERT INTO public.company_content (slug, title) VALUES
('bonus', 'Bônus Millennials'),
('lemas', 'Lemas da Empresa');

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_call_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_daily_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_daily_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "CEO can view all clients" ON public.clients
FOR SELECT USING (public.is_ceo(auth.uid()));

CREATE POLICY "Gestor de Projetos can view clients in their group" ON public.clients
FOR SELECT USING (
    public.has_role(auth.uid(), 'gestor_projetos') 
    AND group_id = public.get_user_group_id(auth.uid())
);

CREATE POLICY "Ads Manager can view assigned clients" ON public.clients
FOR SELECT USING (assigned_ads_manager = auth.uid());

CREATE POLICY "Admin can create clients" ON public.clients
FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update clients" ON public.clients
FOR UPDATE USING (public.is_admin(auth.uid()));

-- RLS for ads_tasks (own tasks only)
CREATE POLICY "Users can manage own tasks" ON public.ads_tasks
FOR ALL USING (ads_manager_id = auth.uid());

-- RLS for ads_daily_documentation
CREATE POLICY "Users can manage own documentation" ON public.ads_daily_documentation
FOR ALL USING (ads_manager_id = auth.uid());

CREATE POLICY "Admin can view all documentation" ON public.ads_daily_documentation
FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS for client_daily_tracking
CREATE POLICY "Users can manage own tracking" ON public.client_daily_tracking
FOR ALL USING (ads_manager_id = auth.uid());

CREATE POLICY "Admin can view all tracking" ON public.client_daily_tracking
FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS for ads_justifications
CREATE POLICY "Users can manage own justifications" ON public.ads_justifications
FOR ALL USING (ads_manager_id = auth.uid());

CREATE POLICY "Admin can view all justifications" ON public.ads_justifications
FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS for ads_meetings (read-only for ads managers)
CREATE POLICY "Admin can manage meetings" ON public.ads_meetings
FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Ads managers can view their meetings" ON public.ads_meetings
FOR SELECT USING (ads_manager_id = auth.uid());

-- RLS for pro_tools (CEO can edit, all can read)
CREATE POLICY "Everyone can view pro tools" ON public.pro_tools
FOR SELECT USING (true);

CREATE POLICY "CEO can manage pro tools" ON public.pro_tools
FOR ALL USING (public.is_ceo(auth.uid()));

-- RLS for company_content
CREATE POLICY "Everyone can view company content" ON public.company_content
FOR SELECT USING (true);

CREATE POLICY "CEO can manage company content" ON public.company_content
FOR ALL USING (public.is_ceo(auth.uid()));

-- RLS for onboarding tables
CREATE POLICY "Ads manager can manage assigned client onboarding" ON public.client_onboarding
FOR ALL USING (
    client_id IN (SELECT id FROM public.clients WHERE assigned_ads_manager = auth.uid())
);

CREATE POLICY "Admin can manage all onboarding" ON public.client_onboarding
FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Ads manager can manage assigned client checklists" ON public.onboarding_checklists
FOR ALL USING (
    client_id IN (SELECT id FROM public.clients WHERE assigned_ads_manager = auth.uid())
);

CREATE POLICY "Admin can manage all checklists" ON public.onboarding_checklists
FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Ads manager can manage assigned client call forms" ON public.client_call_forms
FOR ALL USING (
    client_id IN (SELECT id FROM public.clients WHERE assigned_ads_manager = auth.uid())
);

CREATE POLICY "Admin can manage all call forms" ON public.client_call_forms
FOR ALL USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_call_forms_updated_at BEFORE UPDATE ON public.client_call_forms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_daily_documentation_updated_at BEFORE UPDATE ON public.ads_daily_documentation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_daily_tracking_updated_at BEFORE UPDATE ON public.client_daily_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_tasks_updated_at BEFORE UPDATE ON public.ads_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_onboarding_updated_at BEFORE UPDATE ON public.client_onboarding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pro_tools_updated_at BEFORE UPDATE ON public.pro_tools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_content_updated_at BEFORE UPDATE ON public.company_content
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();