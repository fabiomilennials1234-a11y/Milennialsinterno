import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  User,
  Package,
  DollarSign,
  Building2,
  AlertTriangle,
  Loader2,
  Clock,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAllManagerOptions } from '@/hooks/useAllManagerOptions';
import { useApproveClient, useRejectClient } from '@/hooks/useClientApproval';
import { PRODUCT_CONFIG } from '@/components/shared/ProductBadges';
import type { ClientAreaItem } from '@/hooks/useClientArea';

interface Props {
  client: ClientAreaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSIGNABLE_PRODUCTS = [
  'millennials-growth',
  'millennials-outbound',
  'millennials-paddock',
  'torque-crm',
  'millennials-hunting',
  'gestor-mktplace',
];

export default function ClientApprovalModal({ client, open, onOpenChange }: Props) {
  const { data: managers, isLoading: managersLoading } = useAllManagerOptions();
  const approveClient = useApproveClient();
  const rejectClient = useRejectClient();

  // Form state
  const [adsManager, setAdsManager] = useState<string>('');
  const [sucessoCliente, setSucessoCliente] = useState<string>('');
  const [comercial, setComercial] = useState<string>('');
  const [crm, setCrm] = useState<string>('');
  const [products, setProducts] = useState<string[]>([]);
  const [monthlyValue, setMonthlyValue] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Reset form when client changes
  useEffect(() => {
    if (client) {
      setAdsManager(client.assigned_ads_manager || '');
      setSucessoCliente(client.assigned_sucesso_cliente || '');
      setComercial(client.assigned_comercial || '');
      setCrm(client.assigned_crm || '');
      setProducts(client.contracted_products || []);
      setMonthlyValue(client.monthly_value?.toString() || '');
      setRejectionReason('');
      setShowRejectForm(false);
    }
  }, [client]);

  if (!client) return null;

  const isPending = client.cx_validation_status === 'aguardando_validacao';
  const isApproved = client.cx_validation_status === 'validado';
  const isRejected = client.cx_validation_status === 'reprovado';

  const toggleProduct = (slug: string) => {
    setProducts(prev =>
      prev.includes(slug) ? prev.filter(p => p !== slug) : [...prev, slug]
    );
  };

  const cleanId = (v: string) => (v && v !== 'none' ? v : null);

  const handleApprove = () => {
    approveClient.mutate(
      {
        clientId: client.id,
        assignments: {
          assigned_ads_manager: cleanId(adsManager),
          assigned_sucesso_cliente: cleanId(sucessoCliente),
          assigned_comercial: cleanId(comercial),
          assigned_crm: cleanId(crm),
        },
        contracted_products: products.length > 0 ? products : undefined,
        monthly_value: monthlyValue ? parseFloat(monthlyValue) : undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const handleReject = () => {
    rejectClient.mutate(
      {
        clientId: client.id,
        reason: rejectionReason || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const isMutating = approveClient.isPending || rejectClient.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <Building2 size={20} className="text-muted-foreground" />
            {client.name}
            {isPending && (
              <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                <Clock size={10} className="mr-1" />
                Aguardando Aprovacao
              </Badge>
            )}
            {isApproved && (
              <Badge variant="outline" className="ml-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                <CheckCircle2 size={10} className="mr-1" />
                Aprovado
              </Badge>
            )}
            {isRejected && (
              <Badge variant="outline" className="ml-2 bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">
                <XCircle size={10} className="mr-1" />
                Reprovado
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Client Info Section */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 rounded-lg bg-muted/20 border border-border/20">
          <InfoRow label="Razao Social" value={client.razao_social} />
          <InfoRow label="CNPJ" value={client.cnpj ? formatCNPJ(client.cnpj) : null} mono />
          <InfoRow label="Nicho" value={client.niche} />
          <InfoRow label="Telefone" value={client.phone} />
          <InfoRow
            label="Data Entrada"
            value={client.entry_date
              ? format(new Date(client.entry_date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : null}
          />
          <InfoRow
            label="Investimento Previsto"
            value={client.expected_investment
              ? `R$ ${client.expected_investment.toLocaleString('pt-BR')}`
              : null}
          />
          <InfoRow
            label="Duracao Contrato"
            value={client.contract_duration_months
              ? `${client.contract_duration_months} meses`
              : null}
          />
          <InfoRow
            label="Dia Vencimento"
            value={client.payment_due_day?.toString()}
          />
          {client.general_info && (
            <div className="col-span-2">
              <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider mb-1">
                Observacoes
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {client.general_info}
              </p>
            </div>
          )}
        </div>

        {/* Only show edit form for pending clients */}
        {isPending && (
          <>
            <Separator className="bg-border/20" />

            {/* Team Assignment Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold">Equipe</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ManagerSelect
                  label="Gestor de ADS"
                  value={adsManager}
                  onChange={setAdsManager}
                  options={managers?.gestores_ads || []}
                  loading={managersLoading}
                />
                <ManagerSelect
                  label="Sucesso do Cliente"
                  value={sucessoCliente}
                  onChange={setSucessoCliente}
                  options={managers?.sucesso_cliente || []}
                  loading={managersLoading}
                />
                <ManagerSelect
                  label="Consultor Comercial"
                  value={comercial}
                  onChange={setComercial}
                  options={managers?.comercial || []}
                  loading={managersLoading}
                />
                <ManagerSelect
                  label="Gestor CRM"
                  value={crm}
                  onChange={setCrm}
                  options={managers?.crm || []}
                  loading={managersLoading}
                />
              </div>
            </div>

            <Separator className="bg-border/20" />

            {/* Products Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold">Produtos Contratados</h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {ASSIGNABLE_PRODUCTS.map(slug => {
                  const config = PRODUCT_CONFIG[slug];
                  const selected = products.includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleProduct(slug)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                        'border transition-all duration-200',
                        selected
                          ? `${config?.color || 'bg-primary/10 text-primary border-primary/20'} ring-1 ring-primary/30`
                          : 'bg-muted/20 text-muted-foreground/50 border-border/30 hover:border-border/60'
                      )}
                    >
                      {selected && <CheckCircle2 size={12} />}
                      {config?.name || slug}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-border/20" />

            {/* Value Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold">Valor Mensal</h3>
              </div>

              <div className="max-w-xs">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">
                    R$
                  </span>
                  <Input
                    type="number"
                    value={monthlyValue}
                    onChange={e => setMonthlyValue(e.target.value)}
                    placeholder="0"
                    className="pl-10 bg-background/50 border-border/50"
                    min={0}
                    step={100}
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border/20" />

            {/* Rejection form (toggle) */}
            {showRejectForm && (
              <div className="space-y-3 p-4 rounded-lg bg-red-500/[0.03] border border-red-500/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-red-400">Reprovar Cliente</h3>
                </div>
                <Textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Motivo da reprovacao (opcional)..."
                  className="bg-background/50 border-red-500/20 min-h-[80px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReject}
                    disabled={isMutating}
                  >
                    {rejectClient.isPending ? (
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <XCircle size={14} className="mr-1.5" />
                    )}
                    Confirmar Reprovacao
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRejectForm(false)}
                    disabled={isMutating}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-between pt-2">
              {!showRejectForm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRejectForm(true)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  disabled={isMutating}
                >
                  <XCircle size={14} className="mr-1.5" />
                  Reprovar
                </Button>
              )}
              {showRejectForm && <div />}
              <Button
                onClick={handleApprove}
                disabled={isMutating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {approveClient.isPending ? (
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 size={14} className="mr-1.5" />
                )}
                Aprovar Cliente
              </Button>
            </div>
          </>
        )}

        {/* Read-only view for already processed clients */}
        {!isPending && (
          <div className="space-y-3">
            <Separator className="bg-border/20" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="Gestor ADS" value={client.ads_manager_name} />
              <InfoRow label="Sucesso Cliente" value={client.sucesso_cliente_name} />
              <InfoRow label="Comercial" value={client.comercial_name} />
              <InfoRow label="CRM" value={client.crm_name} />
              <InfoRow
                label="Valor Mensal"
                value={client.monthly_value
                  ? `R$ ${client.monthly_value.toLocaleString('pt-BR')}`
                  : null}
              />
              <InfoRow
                label="Produtos"
                value={(client.contracted_products || []).map(formatProductName).join(', ') || null}
              />
              {isRejected && client.cx_validation_notes && (
                <div className="col-span-2 p-3 rounded-lg bg-red-500/[0.03] border border-red-500/10">
                  <p className="text-[10px] font-semibold text-red-400/60 uppercase tracking-wider mb-1">
                    Motivo da Reprovacao
                  </p>
                  <p className="text-xs text-red-300/80">{client.cx_validation_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className={cn('text-sm text-foreground/80', mono && 'font-mono', !value && 'text-muted-foreground/30 italic')}>
        {value || 'N/A'}
      </p>
    </div>
  );
}

function ManagerSelect({
  label,
  value,
  onChange,
  options,
  loading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  loading: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground/60">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50">
          <SelectValue placeholder={loading ? 'Carregando...' : 'Selecionar'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum</SelectItem>
          {options.map(opt => (
            <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
}

function formatProductName(slug: string): string {
  return PRODUCT_CONFIG[slug]?.name || slug;
}
