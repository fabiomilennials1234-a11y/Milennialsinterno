-- Adicionar coluna de produtos vinculados em financeiro_contas_pagar
ALTER TABLE financeiro_contas_pagar 
ADD COLUMN IF NOT EXISTS produtos_vinculados text[] DEFAULT '{}';

-- Adicionar coluna de produto_slug em financeiro_contas_receber (vem do cadastro do cliente)
ALTER TABLE financeiro_contas_receber
ADD COLUMN IF NOT EXISTS produto_slug text;

-- Criar índice para melhor performance nas consultas por produto
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_pagar_produtos ON financeiro_contas_pagar USING GIN (produtos_vinculados);

CREATE INDEX IF NOT EXISTS idx_financeiro_contas_receber_produto ON financeiro_contas_receber (produto_slug);