// UX — Ferramentas PRO+ (Ads)
// Decisão de design (hm-design validou):
// - Card "Treinamentos Milennials" e "Contas da Millennials" dependem das credenciais
//   Make. Sem credencial → card fica oculto para usuário comum; admins veem card em
//   estado neutro com hint "Configurar acesso".
// - Durante loading, skeleton imita o kanban-card real (mesma altura/border) em vez
//   de texto "Carregando…" — preserva layout e dá hint de identidade purple.
// - Proibido texto "Credencial indisponível" exposto ao usuário final.
import { useMemo, useState } from 'react';
import { ExternalLink, Lock } from 'lucide-react';
import AdsCardDetailModal from './AdsCardDetailModal';
import { useToolCredential } from '@/hooks/useToolCredentials';
import { useAuth } from '@/contexts/AuthContext';

interface ProTool {
  id: string;
  title: string;
  icon: string;
  content: string;
  link?: string;
  locked?: boolean;
}

const ADMIN_CONFIG_HINT =
  'Credenciais ainda não configuradas no workspace. Peça ao admin para cadastrar em Ajustes > Integrações.';

function CredentialCardSkeleton() {
  return (
    <div
      className="kanban-card p-4 motion-safe:animate-pulse"
      style={{ borderLeft: '3px solid hsl(258 90% 66% / 0.3)' }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-5 rounded bg-muted/60" />
        <div className="h-4 w-48 rounded bg-muted/60" />
      </div>
    </div>
  );
}

export default function AdsFerramentasSection() {
  const { isAdminUser } = useAuth();
  const [selectedCard, setSelectedCard] = useState<{
    id: string;
    title: string;
    description?: string;
    icon?: string;
    link?: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const makeLogin = useToolCredential('make', 'login');
  const makePassword = useToolCredential('make', 'password');

  const makeReady =
    !!makeLogin.data?.credential_value && !!makePassword.data?.credential_value;
  const makeLoading = makeLogin.isLoading || makePassword.isLoading;

  const proTools = useMemo<ProTool[]>(() => {
    const makeCredentialsBlock = makeReady
      ? `Login: ${makeLogin.data?.credential_value}\nSenha: ${makePassword.data?.credential_value}`
      : null;

    const tools: ProTool[] = [
      {
        id: 'gpt_roteiros',
        title: 'GPT Criador de Roteiros + Criador de LPS',
        icon: '🤖',
        content: 'Link GPT criador de Roteiros: https://chatgpt.com/g/g-686c023b986c8191962685759aae92f6-copywriter-de-ads\n\nLink GPT criador de LPS: https://chatgpt.com/g/g-689cd56730b081919379c4bbc3a6e6a5-criador-de-lps',
      },
      {
        id: 'swipe_file',
        title: 'Swipe File (Roteiros)',
        icon: '📝',
        content: 'Segue o link dos drives de todos os Clientes Millennials:\n\nhttps://drive.google.com/drive/folders/1V5-73rx9qTT0XUBNdtyZxrO59WoxVahx?usp=sharing',
      },
      {
        id: 'tipos_video',
        title: 'Tipos de Vídeo + Estático',
        icon: '🎬',
        content: 'Tipos de vídeos Millennials: https://www.figma.com/proto/nHb8ohFWe2chaaeYmNZWRa/Central-Swipe-File-Milennials?page-id=0%3A1&node-id=2-3&viewport=1345%2C-195%2C0.16&t=apqxeXuy7XuizXrt-1&scaling=min-zoom&content-scaling=fixed&starting-point-node-id=2%3A266',
      },
    ];

    // Card "Treinamentos Milennials" — conteúdo inclui credenciais Make.
    if (makeReady) {
      tools.push({
        id: 'clientes_millennials',
        title: 'Treinamentos Milennials',
        icon: '👥',
        content: `Como se livrar de Leads a distância:\nhttps://drive.google.com/drive/folders/18FwEAFLqwUIBp6CASjYKWcfettLJt-9R?usp=sharing\n\nComo gravar um bom anúncio:\nhttps://drive.google.com/drive/folders/1S5AY5cDEq3kdUud4wT0zJ4v-_wuo8xUC?usp=sharing\n\nComo rodar anúncios sem pagar impostos:\nhttps://drive.google.com/drive/folders/1F1vdNAJvRw3Y3Y7tzTtxA29absoHZ1YN?usp=sharing\n\nTreinamento Gestor de sucesso:\nhttps://pay.hotmart.com/R101977821G?bid=1773845381131\n\nComo fazer Automação CRM dos Clientes:\nAcesso Make\n${makeCredentialsBlock}\nDrive Tutorial: https://drive.google.com/drive/folders/1tBQJg75kKvWMEI9TVgi_BBKBzeli58Db?usp=sharing`,
      });
    } else if (!makeLoading) {
      // Sem credencial: versão sem bloco de credenciais (conteúdo útil preservado)
      tools.push({
        id: 'clientes_millennials',
        title: 'Treinamentos Milennials',
        icon: '👥',
        content: `Como se livrar de Leads a distância:\nhttps://drive.google.com/drive/folders/18FwEAFLqwUIBp6CASjYKWcfettLJt-9R?usp=sharing\n\nComo gravar um bom anúncio:\nhttps://drive.google.com/drive/folders/1S5AY5cDEq3kdUud4wT0zJ4v-_wuo8xUC?usp=sharing\n\nComo rodar anúncios sem pagar impostos:\nhttps://drive.google.com/drive/folders/1F1vdNAJvRw3Y3Y7tzTtxA29absoHZ1YN?usp=sharing\n\nTreinamento Gestor de sucesso:\nhttps://pay.hotmart.com/R101977821G?bid=1773845381131\n\nDrive Tutorial: https://drive.google.com/drive/folders/1tBQJg75kKvWMEI9TVgi_BBKBzeli58Db?usp=sharing`,
      });
    }

    tools.push(
      {
        id: 'lista_marcos',
        title: 'Lista dos marcos',
        icon: '📋',
        content: 'Aqui estão todos os marcos. Baixe e envie para o seu cliente.\n\nDrive Marcos Mensagem OU Cadastro: https://drive.google.com/drive/folders/1f9-e8_UgVNOwWn1NqhwI2LrdeKgkdpvY?usp=sharing\n\nDrive Marcos E-COMMERCE: https://drive.google.com/drive/folders/1_O5gaL42hBRgZbT07ME1hGWfI3zv9gZB?usp=sharing',
      },
      {
        id: 'docs_copy',
        title: 'DOCS para envio de Copy estática Millennials',
        icon: '📄',
        content: 'Docs para envio dos roteiros: https://docs.google.com/document/d/16RpGQGaiByiwPOqYkTT1ntPvkjOvL5__Z1iOOewib60/edit?usp=sharing',
      },
      {
        id: 'docs_roteiros',
        title: 'DOCS para envio de Roteiros Millennials',
        icon: '📄',
        content: 'Docs para envio dos roteiros: https://docs.google.com/document/d/192N_CS-PLTCwF1b8Ic_dyuqQ0FVTKqRIap-_9hEaCDM/edit?usp=sharing',
      },
      {
        id: 'link_consultorias',
        title: 'Link Consultorias',
        icon: '🔗',
        content: 'Consultoria Comercial: https://calendar.app.google/SLvYeXytixEjmiJy9\n\nConsultoria De Produção de Conteúdo: https://calendar.app.google/Mo944qpPSpZQAYdYA',
      },
      {
        id: 'drive_clientes',
        title: 'Drive Clientes',
        icon: '📁',
        content: '',
      },
      {
        id: 'relatorio_reportei',
        title: 'Relatório Reportei',
        icon: '📈',
        content: 'Olá, pessoal! 👋\nTodos os relatórios da Millennials são disponibilizados em tempo real para os clientes (e também fazemos o envio semanal em PDF).\n\nVocê, como Gestor, já deve ter recebido seu acesso por e-mail. Caso ainda não tenha recebido, entre em contato com o seu Gestor de Projetos.\n\n📌 Tutorial de como criar relatórios em tempo real para seus clientes:\n\nhttps://drive.google.com/file/d/1Ge8WAptlLGBUhFOTdx8i0_8vZBUqz_gu/view?usp=sharing',
      },
    );

    // Card "Contas da Millennials" — depende de credenciais Make.
    if (makeReady) {
      tools.push({
        id: 'contas_millennials',
        title: 'Contas da Millennials',
        icon: '🏦',
        content: `Conta de ADS: anapauladospassos53@gmail.com\n\nGmail Millennials: milennialswebservices@gmail.com\n\nAcesso Make\n${makeCredentialsBlock}`,
      });
    } else if (!makeLoading && isAdminUser) {
      tools.push({
        id: 'contas_millennials',
        title: 'Contas da Millennials',
        icon: '🏦',
        content: ADMIN_CONFIG_HINT,
        locked: true,
      });
    }

    tools.push({
      id: 'tabela_bonus',
      title: 'Tabela de Bônus Millennials',
      icon: '💰',
      content: 'TABELA GANHO DE BÔNUS MILENNIALS',
    });

    tools.push({
      id: 'cursos_torque',
      title: 'Acessar Cursos Torque',
      icon: '🎓',
      content: 'Curso [Torque] Gestor de CRM:\nhttps://drive.google.com/drive/folders/1q-QCOVMp_5KHTU7fDl8NcaUyZVn0LV4s?usp=sharing\n\nCurso [Torque] Cliente:\nhttps://drive.google.com/drive/folders/16MwAKqqSqQ-PLfgW1bqd5YftXEuoUeZg?usp=sharing',
    });

    return tools;
  }, [
    makeReady,
    makeLoading,
    isAdminUser,
    makeLogin.data?.credential_value,
    makePassword.data?.credential_value,
  ]);

  const handleCardClick = (tool: ProTool) => {
    setSelectedCard({
      id: tool.id,
      title: tool.title,
      description: tool.content,
      icon: tool.icon,
      link: tool.link,
    });
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="space-y-2">
        {proTools.map(tool => (
          <div
            key={tool.id}
            onClick={() => handleCardClick(tool)}
            className="kanban-card p-4 group cursor-pointer"
            style={{ borderLeft: '3px solid hsl(258 90% 66%)' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{tool.icon}</span>
              <span className="font-medium text-sm text-foreground group-hover:text-purple transition-colors">
                {tool.title}
              </span>
              {tool.locked && (
                <span
                  className="ml-auto flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70"
                  aria-label="Credencial ainda não configurada"
                >
                  <Lock size={11} />
                  Configurar
                </span>
              )}
              {tool.link && !tool.locked && (
                <ExternalLink size={12} className="text-purple opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              )}
            </div>
          </div>
        ))}

        {makeLoading && <CredentialCardSkeleton />}
      </div>

      <AdsCardDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        card={selectedCard}
        onSave={() => {}}
        listName="Ferramentas PRO+"
        readOnly={true}
      />
    </>
  );
}
