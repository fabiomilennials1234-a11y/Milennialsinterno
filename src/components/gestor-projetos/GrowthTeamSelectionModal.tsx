import { useState, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Users,
  Loader2,
  Megaphone,
  MessageSquare,
  ShoppingBag,
  BarChart3,
  HeartHandshake,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  useGroupProfessionalsByRole,
  GROWTH_TEAM_LIMITS,
} from '@/hooks/useGrowthTeamProfessionals';

interface GrowthTeamSelectionModalProps {
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GrowthTeamSelectionModal({
  clientId,
  onClose,
  onSuccess,
}: GrowthTeamSelectionModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [adsManagerId, setAdsManagerId] = useState('');
  const [comercialId, setComercialId] = useState('');
  const [crmId, setCrmId] = useState('');
  const [cxId, setCxId] = useState('');
  const [hasMktplace, setHasMktplace] = useState(false);
  const [mktplaceId, setMktplaceId] = useState('');

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['growth-client-detail', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, group_id')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; group_id: string | null };
    },
  });

  const groupId = client?.group_id ?? null;

  const { data: adsManagers = [], isLoading: adsLoading } =
    useGroupProfessionalsByRole('gestor_ads', groupId);
  const { data: comerciais = [], isLoading: comercialLoading } =
    useGroupProfessionalsByRole('consultor_comercial', groupId);
  const { data: crmManagers = [], isLoading: crmLoading } =
    useGroupProfessionalsByRole('gestor_crm', groupId);
  const { data: cxProfessionals = [], isLoading: cxLoading } =
    useGroupProfessionalsByRole('sucesso_cliente', groupId);
  const { data: mktplaceConsultants = [], isLoading: mktplaceLoading } =
    useGroupProfessionalsByRole('consultor_mktplace', groupId);

  const canSubmit = useMemo(() => {
    if (!adsManagerId || !comercialId || !crmId || !cxId) return false;
    if (hasMktplace && !mktplaceId) return false;
    return true;
  }, [adsManagerId, comercialId, crmId, cxId, hasMktplace, mktplaceId]);

  const assignTeam = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('auth required');
      if (!client) throw new Error('client not loaded');

      // 1. Assign full team via RPC
      const { error: rpcError } = await supabase.rpc('growth_assign_full_team', {
        p_client_id: clientId,
        p_ads: adsManagerId,
        p_comercial: comercialId,
        p_crm: crmId,
        p_cx: cxId,
        p_mktplace: hasMktplace ? mktplaceId : undefined,
      });
      if (rpcError) throw rpcError;

      // 2. Advance GP step to acompanhamento_gestores
      const { error: stepError } = await supabase.rpc('growth_advance_gp_step', {
        p_client_id: clientId,
        p_new_step: 'acompanhamento_gestores',
      });
      if (stepError) throw stepError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['growth-novos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['growth-acompanhamento'] });
      queryClient.invalidateQueries({ queryKey: ['growth-gp-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags-batch'] });
      queryClient.invalidateQueries({ queryKey: ['all-gestor-client-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-treinador-client-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-mktplace-client-counts'] });
      toast.success('Equipe Growth designada com sucesso!');
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error('Erro ao designar equipe', { description: error.message });
    },
  });

  const isLoading =
    clientLoading || adsLoading || comercialLoading || crmLoading || cxLoading;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Users className="text-cyan-500" size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                ESCOLHER EQUIPE GROWTH:
              </DialogTitle>
              {client && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {client.name}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="text-sm mt-3 leading-relaxed">
            Selecione os profissionais que acompanharão este cliente Growth.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {/* 1. Gestor de ADS */}
            <ProfessionalSelect
              icon={<Megaphone size={16} className="text-blue-400" />}
              label="Gestor de ADS"
              required
              professionals={adsManagers}
              limit={GROWTH_TEAM_LIMITS.gestor_ads}
              value={adsManagerId}
              onChange={setAdsManagerId}
              placeholder="Selecionar Gestor de ADS..."
            />

            {/* 2. Treinador Comercial */}
            <ProfessionalSelect
              icon={<MessageSquare size={16} className="text-emerald-400" />}
              label="Treinador Comercial"
              required
              professionals={comerciais}
              limit={GROWTH_TEAM_LIMITS.consultor_comercial}
              value={comercialId}
              onChange={setComercialId}
              placeholder="Selecionar Treinador Comercial..."
            />

            {/* 3. Gestor de CRM */}
            <ProfessionalSelect
              icon={<BarChart3 size={16} className="text-amber-400" />}
              label="Gestor de CRM"
              required
              professionals={crmManagers}
              limit={GROWTH_TEAM_LIMITS.gestor_crm}
              value={crmId}
              onChange={setCrmId}
              placeholder="Selecionar Gestor de CRM..."
            />

            {/* 4. Sucesso do Cliente / CX */}
            <ProfessionalSelect
              icon={<HeartHandshake size={16} className="text-rose-400" />}
              label="Sucesso do Cliente"
              required
              professionals={cxProfessionals}
              limit={GROWTH_TEAM_LIMITS.sucesso_cliente}
              value={cxId}
              onChange={setCxId}
              placeholder="Selecionar Sucesso do Cliente..."
            />

            {/* 5. Consultoria de MKT Place (opcional) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-purple-400" />
                  <Label className="text-sm font-semibold">
                    Consultoria de MKT Place
                  </Label>
                </div>
                <Switch
                  checked={hasMktplace}
                  onCheckedChange={(checked) => {
                    setHasMktplace(checked);
                    if (!checked) setMktplaceId('');
                  }}
                />
              </div>

              {hasMktplace && (
                <div className="animate-fade-in">
                  <Select value={mktplaceId} onValueChange={setMktplaceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          mktplaceLoading
                            ? 'Carregando...'
                            : mktplaceConsultants.length === 0
                              ? 'Nenhum consultor no grupo'
                              : 'Selecionar Consultor MKT Place...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {mktplaceConsultants.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.name} — {p.client_count}/
                          {GROWTH_TEAM_LIMITS.consultor_mktplace}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="border-t border-border pt-4">
              <Button
                className="w-full"
                size="lg"
                disabled={!canSubmit || assignTeam.isPending}
                onClick={() => assignTeam.mutate()}
              >
                {assignTeam.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  'Confirmar Equipe'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// -- Internal components -------------------------------------------------------

interface ProfessionalSelectProps {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  professionals: { user_id: string; name: string; client_count: number }[];
  limit: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function ProfessionalSelect({
  icon,
  label,
  required,
  professionals,
  limit,
  value,
  onChange,
  placeholder,
}: ProfessionalSelectProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <Label className="text-sm font-semibold">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={
              professionals.length === 0
                ? 'Nenhum profissional no grupo'
                : placeholder
            }
          />
        </SelectTrigger>
        <SelectContent>
          {professionals.map((p) => (
            <SelectItem key={p.user_id} value={p.user_id}>
              {p.name} — {p.client_count}/{limit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
