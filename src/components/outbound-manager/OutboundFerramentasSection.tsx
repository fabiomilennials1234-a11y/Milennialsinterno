// UX — Ferramentas PRO+ (Outbound)
// Decisão de design (hm-design validou):
// - Cards cujo conteúdo depende de credencial (Contas Millennials, Acesso Cursos) só
//   renderizam quando `tool_credentials` retorna valor. Se ausentes:
//     - usuário comum: card some (ordem preservada nos demais itens).
//     - admin (CEO/CTO/Gestor de Projetos): card renderiza em estado neutro
//       com hint discreto "Configurar acesso" para ação de configuração.
// - Durante loading, renderizamos skeleton que imita kanban-card (mesma altura,
//   border-left purple com opacidade reduzida) — evita pulo de layout.
// - Proibido texto "Credencial indisponível" exposto ao usuário final.
import { useMemo, useState } from 'react';
import { ExternalLink, Lock } from 'lucide-react';
import OutboundCardDetailModal from './OutboundCardDetailModal';
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

export default function OutboundFerramentasSection() {
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
  const cursosLogin = useToolCredential('cursos', 'login');
  const cursosPassword = useToolCredential('cursos', 'password');

  const contasCredentialsReady =
    !!makeLogin.data?.credential_value && !!makePassword.data?.credential_value;
  const cursosCredentialsReady =
    !!cursosLogin.data?.credential_value && !!cursosPassword.data?.credential_value;

  const contasLoading = makeLogin.isLoading || makePassword.isLoading;
  const cursosLoading = cursosLogin.isLoading || cursosPassword.isLoading;

  const proTools = useMemo<ProTool[]>(() => {
    const tools: ProTool[] = [
      { id: 'estrategias', title: 'Estrategias Millennials', icon: '📊', content: 'Escolha a sua estrategia aqui: https://drive.google.com/drive/folders/1YTtNJ7k2TyhgjDJscngf8gs2GqDzlHV0?usp=sharing' },
      { id: 'gpt_roteiros', title: 'GPT Criador de Roteiros + Criador de LPS', icon: '🤖', content: 'Link GPT criador de Roteiros: https://chatgpt.com/g/g-686c023b986c8191962685759aae92f6-copywriter-de-ads\n\nLink GPT criador de LPS: https://chatgpt.com/g/g-689cd56730b081919379c4bbc3a6e6a5-criador-de-lps' },
      { id: 'swipe_file', title: 'Swipe File (Roteiros)', icon: '📝', content: 'Segue o link dos drives de todos os Clientes Millennials:\n\nhttps://drive.google.com/drive/folders/1V5-73rx9qTT0XUBNdtyZxrO59WoxVahx?usp=sharing' },
      { id: 'tipos_video', title: 'Tipos de Video + Estatico', icon: '🎬', content: 'Tipos de videos Millennials: https://www.figma.com/proto/nHb8ohFWe2chaaeYmNZWRa/Central-Swipe-File-Milennials?page-id=0%3A1&node-id=2-3&viewport=1345%2C-195%2C0.16&t=apqxeXuy7XuizXrt-1&scaling=min-zoom&content-scaling=fixed&starting-point-node-id=2%3A266' },
      { id: 'clientes_millennials', title: 'Materiais de apoio', icon: '👥', content: 'Como desativar o Advantage da forma correta:\nhttps://drive.google.com/drive/folders/1CRG85AK_15k4fTOPZ5T7NDtGNImEsPRy?usp=sharing\n\nComo gravar um bom anuncio:\nhttps://drive.google.com/drive/folders/1S5AY5cDEq3kdUud4wT0zJ4v-_wuo8xUC?usp=sharing\n\nComo rodar anuncios sem pagar impostos:\nhttps://drive.google.com/drive/folders/1F1vdNAJvRw3Y3Y7tzTtxA29absoHZ1YN?usp=sharing' },
      { id: 'treinamento', title: 'Treinamento gestor de sucesso', icon: '🎓', content: 'Link para ganhar acesso ao treinamento (Ao pagar, pedir ressarcimento ao gestor de projetos): https://pay.hotmart.com/R101977821G' },
      { id: 'lista_marcos', title: 'Lista dos marcos', icon: '📋', content: 'Aqui estao todos os marcos. Baixe e envie para o seu cliente.\n\nDrive Marcos Mensagem OU Cadastro: https://drive.google.com/drive/folders/1f9-e8_UgVNOwWn1NqhwI2LrdeKgkdpvY?usp=sharing\n\nDrive Marcos E-COMMERCE: https://drive.google.com/drive/folders/1_O5gaL42hBRgZbT07ME1hGWfI3zv9gZB?usp=sharing' },
      { id: 'docs_copy', title: 'DOCS para envio de Copy estatica Millennials', icon: '📄', content: 'Docs para envio dos roteiros: https://docs.google.com/document/d/16RpGQGaiByiwPOqYkTT1ntPvkjOvL5__Z1iOOewib60/edit?usp=sharing' },
      { id: 'docs_roteiros', title: 'DOCS para envio de Roteiros Millennials', icon: '📄', content: 'Docs para envio dos roteiros: https://docs.google.com/document/d/192N_CS-PLTCwF1b8Ic_dyuqQ0FVTKqRIap-_9hEaCDM/edit?usp=sharing' },
      { id: 'link_consultorias', title: 'Link Consultorias', icon: '🔗', content: 'Consultoria Comercial: https://calendar.app.google/SLvYeXytixEjmiJy9\n\nConsultoria De Producao de Conteudo: https://calendar.app.google/Mo944qpPSpZQAYdYA' },
      { id: 'drive_clientes', title: 'Drive Clientes', icon: '📁', content: '' },
      { id: 'contornar_impostos', title: 'Como contornar os impostos dos ADS', icon: '💰', content: '' },
      { id: 'relatorio_reportei', title: 'Relatorio Reportei', icon: '📈', content: 'Ola, pessoal!\nTodos os relatorios da Millennials sao disponibilizados em tempo real para os clientes (e tambem fazemos o envio semanal em PDF).\n\nVoce, como Gestor, ja deve ter recebido seu acesso por e-mail. Caso ainda nao tenha recebido, entre em contato com o seu Gestor de Projetos.\n\nTutorial de como criar relatorios em tempo real para seus clientes:\n\nhttps://drive.google.com/file/d/1Ge8WAptlLGBUhFOTdx8i0_8vZBUqz_gu/view?usp=sharing' },
    ];

    // Card "Contas da Millennials" — depende de credenciais Make.
    if (contasCredentialsReady) {
      tools.push({
        id: 'contas_millennials',
        title: 'Contas da Millennials',
        icon: '🏦',
        content: `Conta de ADS: anapauladospassos53@gmail.com\n\nGmail Millennials: milennialswebservices@gmail.com\n\nAcesso Make\nLogin: ${makeLogin.data?.credential_value}\nSenha: ${makePassword.data?.credential_value}`,
      });
    } else if (!contasLoading && isAdminUser) {
      tools.push({
        id: 'contas_millennials',
        title: 'Contas da Millennials',
        icon: '🏦',
        content: ADMIN_CONFIG_HINT,
        locked: true,
      });
    }

    tools.push({
      id: 'automacao_crm',
      title: 'Como fazer Automacao CRM dos Clientes',
      icon: '⚙️',
      content: 'Todos os treinamentos de automacao: https://drive.google.com/drive/folders/10fLqFUsYRsOQa5H9Rw7LD4nGQRfrXpHW?usp=sharing',
    });

    // Card "Acesso Cursos" — depende de credenciais Cursos.
    if (cursosCredentialsReady) {
      tools.push({
        id: 'acesso_cursos',
        title: 'Acesso Cursos',
        icon: '🎯',
        content: `Como ver os cursos?: https://drive.google.com/file/d/17lWX-KZe8fW-m1UR-gNbP9ai7KLqqrgg/view?usp=sharing\n\nAcesso.\n\nLogin: ${cursosLogin.data?.credential_value}\n\nSenha: ${cursosPassword.data?.credential_value}`,
      });
    } else if (!cursosLoading && isAdminUser) {
      tools.push({
        id: 'acesso_cursos',
        title: 'Acesso Cursos',
        icon: '🎯',
        content: ADMIN_CONFIG_HINT,
        locked: true,
      });
    }

    tools.push({
      id: 'tabela_bonus',
      title: 'Tabela de Bonus Millennials',
      icon: '💰',
      content: 'TABELA GANHO DE BONUS MILENNIALS',
    });

    return tools;
  }, [
    contasCredentialsReady,
    contasLoading,
    cursosCredentialsReady,
    cursosLoading,
    isAdminUser,
    makeLogin.data?.credential_value,
    makePassword.data?.credential_value,
    cursosLogin.data?.credential_value,
    cursosPassword.data?.credential_value,
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

        {contasLoading && <CredentialCardSkeleton />}
        {cursosLoading && <CredentialCardSkeleton />}
      </div>

      <OutboundCardDetailModal
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
