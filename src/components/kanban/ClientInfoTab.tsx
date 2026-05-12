import { useState } from 'react';
import {
  Loader2,
  Palette,
  Film,
  Code2,
  ExternalLink,
  Pencil,
  Plus,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ClientDesignProfile } from '@/hooks/useClientDesignProfiles';
import { type ClientVideoProfile } from '@/hooks/useClientVideoProfiles';
import { type ClientDevProfile } from '@/hooks/useClientDevProfiles';
import ClientDesignProfileModal from '@/components/design/ClientDesignProfileModal';
import ClientVideoProfileModal from '@/components/video/ClientVideoProfileModal';
import ClientDevProfileModal from '@/components/devs/ClientDevProfileModal';

interface ClientInfoTabProps {
  clientId: string;
  clientName: string;
  isDesignBoard: boolean;
  isVideoBoard: boolean;
  isDevBoard: boolean;
  designProfile: ClientDesignProfile | null | undefined;
  videoProfile: ClientVideoProfile | null | undefined;
  devProfile: ClientDevProfile | null | undefined;
  isLoading: boolean;
}

// ─── Helpers ──────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function InfoLink({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</dt>
      <dd>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {url.length > 55 ? url.substring(0, 55) + '...' : url}
          <ExternalLink size={12} />
        </a>
      </dd>
    </div>
  );
}

function InfoNotes({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="border-t border-border pt-3 mt-3">
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Observacoes</dt>
      <dd className="text-sm text-foreground/80 italic whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

// ─── Profile renderers ────────────────────────────────────

function DesignProfileView({ profile }: { profile: ClientDesignProfile }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      <InfoField label="Cores da marca" value={profile.brand_colors} />
      <InfoField label="Tipografia" value={profile.typography} />
      <InfoField label="Estilo visual" value={profile.visual_style} />
      <InfoField label="Instagram" value={profile.instagram_handle} />
      <InfoLink label="Manual de marca" url={profile.brand_manual_url} />
      <InfoLink label="Logo" url={profile.logo_url} />
      <InfoLink label="Website" url={profile.website_url} />
      <div className="col-span-2">
        <InfoNotes value={profile.notes} />
      </div>
    </dl>
  );
}

function VideoProfileView({ profile }: { profile: ClientVideoProfile }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      <InfoField label="Estilo de edicao" value={profile.editing_style} />
      <InfoField label="Formato" value={profile.video_format} />
      <InfoField label="Resolucao" value={profile.resolution} />
      <InfoField label="Ritmo / Pacing" value={profile.pacing} />
      <InfoField label="Estilo de trilha" value={profile.music_style} />
      <InfoField label="Instagram" value={profile.instagram_handle} />
      <InfoField label="TikTok" value={profile.tiktok_handle} />
      <InfoLink label="Canal YouTube" url={profile.youtube_channel} />
      <InfoLink label="Intro / Outro" url={profile.intro_outro_url} />
      <InfoLink label="Referencias" url={profile.reference_urls} />
      <InfoLink label="Assets da marca" url={profile.brand_assets_url} />
      <div className="col-span-2">
        <InfoNotes value={profile.notes} />
      </div>
    </dl>
  );
}

function DevProfileView({ profile }: { profile: ClientDevProfile }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      <InfoField label="Stack frontend" value={profile.frontend_stack} />
      <InfoField label="CSS Framework" value={profile.css_framework} />
      <InfoField label="CMS / Plataforma" value={profile.cms_platform} />
      <InfoField label="Hosting" value={profile.hosting_provider} />
      <InfoField label="Dominio" value={profile.domain} />
      <InfoField label="Analytics ID" value={profile.analytics_id} />
      <InfoLink label="Staging" url={profile.staging_url} />
      <InfoLink label="Repositorio" url={profile.repository_url} />
      <InfoLink label="Figma" url={profile.figma_url} />
      <InfoLink label="API Docs" url={profile.api_docs_url} />
      <div className="col-span-2">
        <InfoField label="Notas de deploy" value={profile.deploy_notes} />
      </div>
      <div className="col-span-2">
        <InfoNotes value={profile.notes} />
      </div>
    </dl>
  );
}

// ─── Main component ───────────────────────────────────────

export default function ClientInfoTab({
  clientId,
  clientName,
  isDesignBoard,
  isVideoBoard,
  isDevBoard,
  designProfile,
  videoProfile,
  devProfile,
  isLoading,
}: ClientInfoTabProps) {
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const profile = isDesignBoard ? designProfile : isVideoBoard ? videoProfile : isDevBoard ? devProfile : null;
  const boardIcon = isDesignBoard ? <Palette size={16} /> : isVideoBoard ? <Film size={16} /> : <Code2 size={16} />;
  const boardLabel = isDesignBoard ? 'Design' : isVideoBoard ? 'Video' : 'Desenvolvimento';

  // ─── Empty state ──────────────────────────────────────
  if (!profile) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Database size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Nenhum perfil de {boardLabel} cadastrado
          </h3>
          <p className="text-xs text-muted-foreground mb-5 max-w-[280px]">
            Cadastre o perfil para que a equipe tenha acesso rapido as informacoes deste cliente.
          </p>
          <button
            onClick={() => setProfileModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all"
          >
            <Plus size={16} />
            Cadastrar perfil
          </button>
        </div>

        {/* Profile modals */}
        {isDesignBoard && (
          <ClientDesignProfileModal
            isOpen={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
            clientId={clientId}
            clientName={clientName}
            existing={null}
          />
        )}
        {isVideoBoard && (
          <ClientVideoProfileModal
            isOpen={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
            clientId={clientId}
            clientName={clientName}
            existing={null}
          />
        )}
        {isDevBoard && (
          <ClientDevProfileModal
            isOpen={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
            clientId={clientId}
            clientName={clientName}
            existing={null}
          />
        )}
      </>
    );
  }

  // ─── Profile view ─────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            {boardIcon}
            Perfil de {boardLabel} — {clientName}
          </h4>
          <button
            onClick={() => setProfileModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border"
          >
            <Pencil size={12} />
            Editar
          </button>
        </div>

        {/* Content */}
        <div className="rounded-xl border border-border bg-muted/30 p-5">
          {isDesignBoard && designProfile && <DesignProfileView profile={designProfile} />}
          {isVideoBoard && videoProfile && <VideoProfileView profile={videoProfile} />}
          {isDevBoard && devProfile && <DevProfileView profile={devProfile} />}
        </div>
      </div>

      {/* Edit modals */}
      {isDesignBoard && designProfile && (
        <ClientDesignProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          clientId={clientId}
          clientName={clientName}
          existing={designProfile}
        />
      )}
      {isVideoBoard && videoProfile && (
        <ClientVideoProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          clientId={clientId}
          clientName={clientName}
          existing={videoProfile}
        />
      )}
      {isDevBoard && devProfile && (
        <ClientDevProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          clientId={clientId}
          clientName={clientName}
          existing={devProfile}
        />
      )}
    </>
  );
}
