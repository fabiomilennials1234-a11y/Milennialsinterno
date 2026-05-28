import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import AdsCardDetailModal from '@/components/ads-manager/AdsCardDetailModal';

interface ProTool {
  id: string;
  title: string;
  icon: string;
  content: string;
  link?: string;
}

// Ferramentas PRO+ específicas do Financeiro
const FINANCEIRO_TOOLS: ProTool[] = [
  {
    id: 'contas_pagar_receber',
    title: 'Contas a pagar e a receber.',
    icon: '📑',
    content: '', // User will provide content later
  },
  {
    id: 'controle_entrada_saida',
    title: 'Controle entrada e saída de clientes.',
    icon: '👩‍💼',
    content: '', // User will provide content later
  },
  {
    id: 'agenda_fabio_leonardo',
    title: 'Agenda Fábio e Leonardo.',
    icon: '🔗',
    content: '', // User will provide content later
  },
  {
    id: 'link_email_comercial',
    title: 'Link e-mail comercial',
    icon: '📧',
    content: '', // User will provide content later
  },
  {
    id: 'acompanhamento_contratos',
    title: 'Acompanhamento/envio de contratos.',
    icon: '🤓',
    content: '', // User will provide content later
  },
  {
    id: 'planilha_nfs',
    title: 'Planilha de emissão de NFS.',
    icon: '📁',
    content: '', // User will provide content later
  },
  {
    id: 'planilha_clientes_porcentagem',
    title: 'Planilha clientes com porcentagem.',
    icon: '🗃️',
    content: '', // User will provide content later
  },
  {
    id: 'site_prefeitura',
    title: 'Site prefeitura para emissão.',
    icon: '⏬',
    content: '',
  },
  {
    id: 'acesso_torquecrm',
    title: 'Acesso TORQUECRM',
    icon: '🔑',
    content: 'Site: www.torquecrm.com.br\n\nLogin: milennialswebservices@gmail.com\nSenha: Milennials123456',
  },
];

interface ToolCard {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  link?: string;
}

export default function FinanceiroFerramentasSection() {
  const [selectedCard, setSelectedCard] = useState<ToolCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        {FINANCEIRO_TOOLS.map(tool => (
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
              {tool.link && (
                <ExternalLink size={12} className="text-purple opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              )}
            </div>
          </div>
        ))}
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
