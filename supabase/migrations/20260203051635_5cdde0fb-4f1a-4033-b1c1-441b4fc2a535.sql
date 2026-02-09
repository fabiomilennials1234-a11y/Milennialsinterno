-- ========================================
-- TABELAS PARA DRE E GESTÃO DE CUSTOS
-- ========================================

-- Tabela para DRE mensal (preenchimento manual)
CREATE TABLE public.financeiro_dre (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia TEXT NOT NULL, -- formato: yyyy-MM
  
  -- RECEITAS
  receita_bruta NUMERIC DEFAULT 0,
  deducoes_impostos NUMERIC DEFAULT 0,
  deducoes_descontos NUMERIC DEFAULT 0,
  outras_deducoes NUMERIC DEFAULT 0,
  -- Receita Líquida = Receita Bruta - Deduções (calculado automaticamente)
  
  -- CUSTOS
  cmv_produtos NUMERIC DEFAULT 0, -- Custo de Mercadorias/Serviços Vendidos
  cmv_servicos NUMERIC DEFAULT 0,
  outros_cmv NUMERIC DEFAULT 0,
  -- Lucro Bruto = Receita Líquida - CMV (calculado automaticamente)
  
  -- DESPESAS OPERACIONAIS
  despesas_pessoal NUMERIC DEFAULT 0,
  despesas_administrativas NUMERIC DEFAULT 0,
  despesas_comerciais NUMERIC DEFAULT 0,
  despesas_marketing NUMERIC DEFAULT 0,
  despesas_ti NUMERIC DEFAULT 0,
  despesas_ocupacao NUMERIC DEFAULT 0, -- Aluguel, condomínio, etc.
  outras_despesas_operacionais NUMERIC DEFAULT 0,
  -- EBITDA = Lucro Bruto - Despesas Operacionais (calculado automaticamente)
  
  -- OUTRAS RECEITAS/DESPESAS
  receitas_financeiras NUMERIC DEFAULT 0,
  despesas_financeiras NUMERIC DEFAULT 0,
  outras_receitas NUMERIC DEFAULT 0,
  outras_despesas NUMERIC DEFAULT 0,
  
  -- IMPOSTOS SOBRE LUCRO
  impostos_lucro NUMERIC DEFAULT 0,
  -- Lucro Líquido = EBITDA + Receitas Financeiras - Despesas Financeiras + Outras - Impostos (calculado automaticamente)
  
  -- Notas/Observações
  notas TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(mes_referencia)
);

-- Tabela para definir produtos da empresa
CREATE TABLE public.financeiro_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- ex: millennials-growth, zydon, saas
  descricao TEXT,
  cor TEXT DEFAULT '#6366f1', -- Cor para identificação visual
  ativo BOOLEAN DEFAULT true,
  position INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para definir departamentos de cada produto
CREATE TABLE public.financeiro_produto_departamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.financeiro_produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, -- ex: Ads, Design, Vídeo, Comercial
  descricao TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para custos mensais por produto/departamento
CREATE TABLE public.financeiro_custos_produto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia TEXT NOT NULL, -- formato: yyyy-MM
  produto_id UUID NOT NULL REFERENCES public.financeiro_produtos(id) ON DELETE CASCADE,
  departamento_id UUID REFERENCES public.financeiro_produto_departamentos(id) ON DELETE SET NULL,
  
  -- Custos
  custo_pessoal NUMERIC DEFAULT 0, -- Salários, benefícios, etc.
  custo_ferramentas NUMERIC DEFAULT 0, -- Software, equipamentos
  custo_terceiros NUMERIC DEFAULT 0, -- Freelancers, terceiros
  custo_marketing NUMERIC DEFAULT 0, -- Marketing específico do produto
  outros_custos NUMERIC DEFAULT 0,
  descricao_outros TEXT,
  
  notas TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(mes_referencia, produto_id, departamento_id)
);

-- Tabela para receita por produto (para calcular margem)
CREATE TABLE public.financeiro_receita_produto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia TEXT NOT NULL, -- formato: yyyy-MM
  produto_id UUID NOT NULL REFERENCES public.financeiro_produtos(id) ON DELETE CASCADE,
  
  -- Receitas
  receita_recorrente NUMERIC DEFAULT 0, -- MRR
  receita_avulsa NUMERIC DEFAULT 0, -- One-time sales
  outras_receitas NUMERIC DEFAULT 0,
  
  -- Número de clientes ativos
  clientes_ativos INT DEFAULT 0,
  
  notas TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(mes_referencia, produto_id)
);

-- Enable RLS
ALTER TABLE public.financeiro_dre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_produto_departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_custos_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_receita_produto ENABLE ROW LEVEL SECURITY;

-- Policies para financeiro_dre (apenas CEO e financeiro)
CREATE POLICY "DRE viewable by authenticated users" 
ON public.financeiro_dre FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "DRE manageable by CEO and financeiro" 
ON public.financeiro_dre FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'financeiro', 'gestor_projetos')
  )
);

-- Policies para financeiro_produtos
CREATE POLICY "Produtos viewable by authenticated users" 
ON public.financeiro_produtos FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Produtos manageable by CEO and financeiro" 
ON public.financeiro_produtos FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'financeiro', 'gestor_projetos')
  )
);

-- Policies para financeiro_produto_departamentos
CREATE POLICY "Departamentos viewable by authenticated users" 
ON public.financeiro_produto_departamentos FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Departamentos manageable by CEO and financeiro" 
ON public.financeiro_produto_departamentos FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'financeiro', 'gestor_projetos')
  )
);

-- Policies para financeiro_custos_produto
CREATE POLICY "Custos viewable by authenticated users" 
ON public.financeiro_custos_produto FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Custos manageable by CEO and financeiro" 
ON public.financeiro_custos_produto FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'financeiro', 'gestor_projetos')
  )
);

-- Policies para financeiro_receita_produto
CREATE POLICY "Receita viewable by authenticated users" 
ON public.financeiro_receita_produto FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Receita manageable by CEO and financeiro" 
ON public.financeiro_receita_produto FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'financeiro', 'gestor_projetos')
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_financeiro_dre_updated_at
BEFORE UPDATE ON public.financeiro_dre
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financeiro_produtos_updated_at
BEFORE UPDATE ON public.financeiro_produtos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financeiro_produto_departamentos_updated_at
BEFORE UPDATE ON public.financeiro_produto_departamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financeiro_custos_produto_updated_at
BEFORE UPDATE ON public.financeiro_custos_produto
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financeiro_receita_produto_updated_at
BEFORE UPDATE ON public.financeiro_receita_produto
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir produtos iniciais baseados nos produtos do sistema
INSERT INTO public.financeiro_produtos (nome, slug, cor, position) VALUES
  ('Millennials Growth', 'millennials-growth', '#6366f1', 0),
  ('Zydon', 'zydon', '#f59e0b', 1),
  ('SAAS', 'saas', '#10b981', 2),
  ('Millennials Hub', 'millennials-hub', '#8b5cf6', 3),
  ('IA Inbound', 'ia-inbound', '#06b6d4', 4),
  ('Gravação Atrizes', 'gravacao-atrizes', '#ec4899', 5),
  ('Edição de Vídeo', 'edicao-video', '#f43f5e', 6),
  ('Design', 'design', '#14b8a6', 7);