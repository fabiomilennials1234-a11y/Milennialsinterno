import { useState, useMemo } from 'react';
import {
  Search,
  Edit3,
  Plus,
  ExternalLink,
  Loader2,
  Database,
  Palette,
  Type,
  Eye,
  Instagram,
  Globe,
  Youtube,
  AtSign,
  Film,
  Code2,
  Link,
  Map,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useClientInfoBanks,
  INFO_BANK_FIELDS,
  INFO_BANK_SECTIONS,
  type ClientWithInfoBank,
  type ClientInfoBankProfile,
  type InfoBankFieldDef,
} from '@/hooks/useClientInfoBank';
import {
  useClientInfoBankFileCounts,
  FILE_SECTIONS,
} from '@/hooks/useClientInfoBankFiles';
import { Badge } from '@/components/ui/badge';
import ClientInfoBankModal from '@/components/client/ClientInfoBankModal';

// ── Helpers ──────────────────────────────────────────────────

function normalizeSearch(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function truncateUrl(url: string, max = 40): string {
  return url.length > max ? url.slice(0, max) + '...' : url;
}

// ── Field icons map ──────────────────────────────────────────

const FIELD_ICON_MAP: Partial<Record<InfoBankFieldDef['key'], React.ComponentType<{ size: number; className?: string }>>> = {
  brand_colors: Palette,
  typography: Type,
  visual_style: Eye,
  brand_manual_url: Link,
  logo_url: Link,
  website_url: Globe,
  instagram_handle: Instagram,
  youtube_channel: Youtube,
  tiktok_handle: AtSign,
  domain: Map,
  editing_style: Film,
  video_formats: Film,
  cms_platform: Code2,
  figma_url: Link,
  notes: StickyNote,
};

const LINK_FIELDS = new Set<InfoBankFieldDef['key']>([
  'brand_manual_url', 'logo_url', 'website_url', 'youtube_channel', 'figma_url',
]);

// ── Profile field renderer ───────────────────────────────────

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

// ── Section header ───────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  marca: <Palette size={11} className="text-primary" />,
  presenca_digital: <Globe size={11} className="text-primary" />,
  video: <Film size={11} className="text-primary" />,
  dev: <Code2 size={11} className="text-primary" />,
  geral: <StickyNote size={11} className="text-primary" />,
};

// ── File section icons for badges ───────────────────────────

const FILE_SECTION_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  anuncios: Globe,
  criativos: Palette,
  marca: Type,
  videos: Film,
};

// ── Client card ─────────────────────────────────────────────

interface ClientCardProps {
  client: ClientWithInfoBank;
  fileCounts?: Record<string, number>;
  onEdit: (client: ClientWithInfoBank) => void;
}

function ClientCard({ client, fileCounts, onEdit }: ClientCardProps) {
  const { profile } = client;
  const hasProfile = !!profile;

  // Group populated fields by section
  const populatedSections = useMemo(() => {
    if (!profile) return [];
    return INFO_BANK_SECTIONS
      .map((section) => {
        const fields = INFO_BANK_FIELDS
          .filter((f) => f.section === section.key)
          .filter((f) => (profile as Record<string, string | null>)[f.key]);
        return fields.length > 0 ? { section, fields } : null;
      })
      .filter(Boolean) as Array<{ section: typeof INFO_BANK_SECTIONS[number]; fields: InfoBankFieldDef[] }>;
  }, [profile]);

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

      {/* File count badges */}
      {fileCounts && Object.keys(fileCounts).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FILE_SECTIONS.filter((s) => fileCounts[s.key] > 0).map((s) => {
            const Icon = FILE_SECTION_ICONS[s.key];
            return (
              <Badge key={s.key} variant="secondary" className="gap-1 text-[10px] px-2 py-0.5">
                {Icon && <Icon size={10} className="opacity-70" />}
                {s.label}: {fileCounts[s.key]}
              </Badge>
            );
          })}
        </div>
      )}

      {hasProfile && populatedSections.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
          {populatedSections.map(({ section, fields }) => (
            <div key={section.key}>
              <div className="flex items-center gap-1.5 mb-2">
                {SECTION_ICONS[section.key]}
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {fields.map((field) => {
                  const FieldIcon = FIELD_ICON_MAP[field.key];
                  const value = (profile as Record<string, string | null>)[field.key];
                  return (
                    <ProfileField
                      key={field.key}
                      icon={FieldIcon ? <FieldIcon size={12} /> : null}
                      label={field.label}
                      value={value}
                      isLink={LINK_FIELDS.has(field.key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function ClientInfoBankTab() {
  const { data: clients, isLoading } = useClientInfoBanks();
  const { data: allFileCounts } = useClientInfoBankFileCounts();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithInfoBank | null>(null);
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

  const handleEdit = (client: ClientWithInfoBank) => {
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
              <ClientCard key={client.id} client={client} fileCounts={allFileCounts?.[client.id]} onEdit={handleEdit} />
            ))}

            {withProfile.length > 0 && withoutProfile.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                  Sem banco de info cadastrado
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>
            )}

            {withoutProfile.map((client) => (
              <ClientCard key={client.id} client={client} fileCounts={allFileCounts?.[client.id]} onEdit={handleEdit} />
            ))}
          </>
        )}
      </div>

      {/* Modal */}
      {selectedClient && (
        <ClientInfoBankModal
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
