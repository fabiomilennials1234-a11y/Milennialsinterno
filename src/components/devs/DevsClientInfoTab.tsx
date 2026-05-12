import { useState, useMemo } from 'react';
import {
  Search,
  Edit3,
  Plus,
  ExternalLink,
  Loader2,
  Database,
  Code2,
  Layers,
  Globe,
  Server,
  Link as LinkIcon,
  Figma,
  BarChart3,
  FileText,
  StickyNote,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useClientDevProfiles,
  type ClientWithDevProfile,
} from '@/hooks/useClientDevProfiles';
import ClientDevProfileModal from '@/components/devs/ClientDevProfileModal';

function normalizeSearch(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function truncateUrl(url: string, max = 40): string {
  return url.length > max ? url.slice(0, max) + '...' : url;
}

interface ProfileFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  isLink?: boolean;
}

function ProfileField({ icon, label, value, isLink }: ProfileFieldProps) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
        {isLink ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 min-w-0"
          >
            <span className="truncate">{truncateUrl(value)}</span>
            <ExternalLink size={10} className="shrink-0" />
          </a>
        ) : (
          <p className="text-xs text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

interface ClientCardProps {
  client: ClientWithDevProfile;
  onEdit: (client: ClientWithDevProfile) => void;
}

function ClientCard({ client, onEdit }: ClientCardProps) {
  const { profile } = client;
  const hasProfile = !!profile;

  return (
    <div
      className={cn(
        'rounded-xl p-4 transition-all',
        hasProfile
          ? 'border border-border bg-background hover:border-primary/30'
          : 'border border-dashed border-border/60 bg-muted/20 hover:border-primary/30'
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{client.name}</h3>
          {client.razao_social && (
            <p className="text-xs text-muted-foreground truncate">{client.razao_social}</p>
          )}
        </div>

        <button
          onClick={() => onEdit(client)}
          className={cn(
            'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            hasProfile
              ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
              : 'text-primary hover:bg-primary/10'
          )}
        >
          {hasProfile ? (
            <>
              <Edit3 size={12} />
              Editar
            </>
          ) : (
            <>
              <Plus size={12} />
              Cadastrar
            </>
          )}
        </button>
      </div>

      {hasProfile && (
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
          <ProfileField
            icon={<Code2 size={12} />}
            label="Stack"
            value={profile.frontend_stack}
          />
          <ProfileField
            icon={<Layers size={12} />}
            label="CSS Framework"
            value={profile.css_framework}
          />
          <ProfileField
            icon={<Globe size={12} />}
            label="CMS"
            value={profile.cms_platform}
          />
          <ProfileField
            icon={<Server size={12} />}
            label="Hosting"
            value={profile.hosting_provider}
          />
          <ProfileField
            icon={<Globe size={12} />}
            label="Dominio"
            value={profile.domain}
          />
          <ProfileField
            icon={<LinkIcon size={12} />}
            label="Staging"
            value={profile.staging_url}
            isLink
          />
          <ProfileField
            icon={<Code2 size={12} />}
            label="Repositorio"
            value={profile.repository_url}
            isLink
          />
          <ProfileField
            icon={<Figma size={12} />}
            label="Figma"
            value={profile.figma_url}
            isLink
          />
          <ProfileField
            icon={<BarChart3 size={12} />}
            label="Analytics"
            value={profile.analytics_id}
          />
          <ProfileField
            icon={<FileText size={12} />}
            label="API Docs"
            value={profile.api_docs_url}
            isLink
          />
          <ProfileField
            icon={<Rocket size={12} />}
            label="Deploy"
            value={profile.deploy_notes}
          />
          <ProfileField
            icon={<StickyNote size={12} />}
            label="Notas"
            value={profile.notes}
          />
        </div>
      )}
    </div>
  );
}

export default function DevsClientInfoTab() {
  const { data: clients, isLoading } = useClientDevProfiles();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithDevProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;

    const q = normalizeSearch(search);
    return clients.filter((c) => {
      const name = normalizeSearch(c.name);
      const razao = c.razao_social ? normalizeSearch(c.razao_social) : '';
      return name.includes(q) || razao.includes(q);
    });
  }, [clients, search]);

  const withProfile = useMemo(() => filtered.filter((c) => c.profile), [filtered]);
  const withoutProfile = useMemo(() => filtered.filter((c) => !c.profile), [filtered]);

  const handleEdit = (client: ClientWithDevProfile) => {
    setSelectedClient(client);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) setSelectedClient(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente por nome..."
          className="input-apple pl-10"
        />
      </div>

      {/* Results */}
      <div className="overflow-y-auto scrollbar-elegant max-h-[calc(100vh-220px)] space-y-3 pr-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Database size={40} className="mb-3 opacity-50" />
            <p className="text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <>
            {withProfile.map((client) => (
              <ClientCard key={client.id} client={client} onEdit={handleEdit} />
            ))}

            {withProfile.length > 0 && withoutProfile.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                  Sem perfil cadastrado
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>
            )}

            {withoutProfile.map((client) => (
              <ClientCard key={client.id} client={client} onEdit={handleEdit} />
            ))}
          </>
        )}
      </div>

      {/* Modal */}
      {selectedClient && (
        <ClientDevProfileModal
          isOpen={modalOpen}
          onClose={() => handleModalClose(false)}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          existing={selectedClient.profile}
        />
      )}
    </div>
  );
}
