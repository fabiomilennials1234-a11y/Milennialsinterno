import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClientsWithSales } from '@/hooks/useClientList';
import { useCreateUpsell } from '@/hooks/useUpsells';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_CONFIG } from '@/components/shared/ProductBadges';
import { TrendingUp, DollarSign, User, Package } from 'lucide-react';

interface CreateUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSUser {
  user_id: string;
  name: string;
}

export function CreateUpsellModal({ open, onOpenChange }: CreateUpsellModalProps) {
  const [clientId, setClientId] = useState('');
  const [productSlug, setProductSlug] = useState('');
  const [monthlyValue, setMonthlyValue] = useState('');
  const [soldBy, setSoldBy] = useState('');
  const [csUsers, setCsUsers] = useState<CSUser[]>([]);
  const [isLoadingCS, setIsLoadingCS] = useState(false);

  const { data: clients = [], isLoading: isLoadingClients } = useClientsWithSales();
  const createUpsell = useCreateUpsell();

  // Filter active clients only
  const activeClients = clients.filter(c => !c.archived && c.status !== 'churned');

  // Load CS users
  useEffect(() => {
    async function loadCSUsers() {
      setIsLoadingCS(true);
      try {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'sucesso_cliente');

        if (roles && roles.length > 0) {
          const userIds = roles.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', userIds);

          setCsUsers(profiles || []);
        }
      } catch (error) {
        console.error('Error loading CS users:', error);
      } finally {
        setIsLoadingCS(false);
      }
    }

    if (open) {
      loadCSUsers();
    }
  }, [open]);

  // Get selected client's current products
  const selectedClient = activeClients.find(c => c.id === clientId);
  const clientProducts = selectedClient?.contracted_products || [];

  // Filter products that the client doesn't have yet
  const availableProducts = Object.entries(PRODUCT_CONFIG).filter(
    ([slug]) => !clientProducts.includes(slug)
  );

  // Get product name helper
  const getProductName = (slug: string) => {
    return PRODUCT_CONFIG[slug as keyof typeof PRODUCT_CONFIG]?.name || slug;
  };

  // Calculate commission preview
  const commissionPreview = monthlyValue ? Number(monthlyValue) * 0.07 : 0;

  const handleSubmit = async () => {
    if (!clientId || !productSlug || !monthlyValue || !soldBy) {
      return;
    }

    const selectedCS = csUsers.find(u => u.user_id === soldBy);
    const productName = getProductName(productSlug);

    await createUpsell.mutateAsync({
      client_id: clientId,
      product_slug: productSlug,
      product_name: productName,
      monthly_value: Number(monthlyValue),
      sold_by: soldBy,
      sold_by_name: selectedCS?.name || 'Desconhecido',
    });

    // Reset form
    setClientId('');
    setProductSlug('');
    setMonthlyValue('');
    setSoldBy('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Registrar UP Sell
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingClients ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : (
                  activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produto
            </Label>
            <Select 
              value={productSlug} 
              onValueChange={setProductSlug}
              disabled={!clientId}
            >
              <SelectTrigger>
                <SelectValue placeholder={clientId ? "Selecione o produto" : "Selecione um cliente primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Cliente já possui todos os produtos
                  </SelectItem>
                ) : (
                  availableProducts.map(([slug, config]) => (
                    <SelectItem key={slug} value={slug}>
                      <span>{config.name}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Monthly Value */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valor Mensal (R$)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={monthlyValue}
              onChange={(e) => setMonthlyValue(e.target.value)}
              placeholder="0,00"
            />
          </div>

          {/* CS User Selection */}
          <div className="space-y-2">
            <Label>Sucesso do Cliente que vendeu</Label>
            <Select value={soldBy} onValueChange={setSoldBy}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o CS" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingCS ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : csUsers.length === 0 ? (
                  <SelectItem value="none" disabled>Nenhum CS encontrado</SelectItem>
                ) : (
                  csUsers.map((cs) => (
                    <SelectItem key={cs.user_id} value={cs.user_id}>
                      {cs.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Commission Preview */}
          {monthlyValue && Number(monthlyValue) > 0 && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Comissão automática (7%):
              </p>
              <p className="text-lg font-bold text-emerald-500">
                R$ {commissionPreview.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!clientId || !productSlug || !monthlyValue || !soldBy || createUpsell.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {createUpsell.isPending ? 'Registrando...' : 'Registrar UP Sell'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
