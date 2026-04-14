import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Building2, Loader2, CheckCircle2, AlertCircle, CalendarDays, Package, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useGroups,
  useSquads,
  useAdsManagers,
  useComercialConsultants,
  useCrmManagers,
  useRhUsers,
  useOutboundManagers,
  useMktplaceConsultants,
  useCreateClient,
} from '@/hooks/useClientRegistration';
import {
  useAllGestorClientCounts,
  useAllTreinadorClientCounts,
  useAllCrmClientCounts,
  useAllOutboundClientCounts,
  useAllMktplaceClientCounts,
} from '@/hooks/useTreinadorClientCount';
import {
  validateCNPJ,
  validateCPF,
  formatCNPJ,
  formatCPF,
  formatCurrency,
  parseCurrency,
} from '@/lib/validators';

// Limites de carteira por cargo (mesmos da Sidebar)
const MANAGER_LIMITS: Record<string, number> = {
  gestor_ads: 25,
  consultor_comercial: 80,
  consultor_mktplace: 80,
  gestor_crm: 80,
  outbound: 80,
};

// Lista de produtos disponíveis
const AVAILABLE_PRODUCTS = [
  { slug: 'millennials-growth', name: 'Millennials Growth', requiresTeam: true },
  { slug: 'millennials-paddock', name: 'Millennials Paddock', requiresTeam: false },
  { slug: 'torque-crm', name: 'Torque CRM', requiresTeam: false },
  { slug: 'gestor-mktplace', name: 'Gestor de MKT Place', requiresTeam: false },
];

// Schema de validação com Zod
const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  cnpj: z
    .string()
    .min(1, 'CNPJ é obrigatório')
    .refine((val) => validateCNPJ(val), {
      message: 'CNPJ inválido. Verifique os dígitos.',
    }),
  cpf: z
    .string()
    .optional()
    .refine((val) => !val || validateCPF(val), {
      message: 'CPF inválido. Verifique os dígitos.',
    }),
  phone: z
    .string()
    .optional(),
  razao_social: z
    .string()
    .trim()
    .min(2, 'Razão Social é obrigatória')
    .max(255, 'Razão Social deve ter no máximo 255 caracteres'),
  niche: z
    .string()
    .trim()
    .min(2, 'Nicho é obrigatório')
    .max(100, 'Nicho deve ter no máximo 100 caracteres'),
  general_info: z
    .string()
    .trim()
    .min(1, 'Este campo é obrigatório')
    .max(1000, 'Informações devem ter no máximo 1000 caracteres'),
  expected_investment: z
    .string()
    .min(1, 'Investimento é obrigatório')
    .refine((val) => parseCurrency(val) > 0, {
      message: 'Investimento deve ser maior que zero',
    }),
  // Valores mensais por produto - objeto dinâmico
  product_values: z.record(z.string(), z.string()).default({}),
  sales_percentage: z
    .number()
    .min(0, 'Porcentagem deve ser entre 0 e 100')
    .max(100, 'Porcentagem deve ser entre 0 e 100'),
  entry_date: z
    .string()
    .min(1, 'Data de entrada é obrigatória'),
  contract_duration_months: z
    .number({ required_error: 'Duração do contrato é obrigatória' })
    .min(1, 'Duração deve ser de pelo menos 1 mês')
    .max(120, 'Duração máxima de 120 meses'),
  payment_due_day: z
    .number({ required_error: 'Dia de vencimento é obrigatório' })
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
  contracted_products: z.array(z.string()).default([]),
  group_id: z.string().optional(),
  squad_id: z.string().optional(),
  assigned_ads_manager: z.string().optional(),
  assigned_comercial: z.string().optional(),
  assigned_crm: z.string().optional(),
  assigned_rh: z.string().optional(),
  assigned_outbound_manager: z.string().optional(),
  assigned_mktplace: z.string().optional(),
}).refine((data) => {
  // Se Millennials Growth está selecionado, exige group_id e squad_id
  const hasMillennialsGrowth = data.contracted_products.includes('millennials-growth');
  if (hasMillennialsGrowth) {
    return !!data.group_id && !!data.squad_id;
  }
  return true;
}, {
  message: 'Para Millennials Growth, Grupo e Squad são obrigatórios',
  path: ['contracted_products'],
}).refine((data) => {
  // Gestor de Ads é obrigatório apenas para Millennials Growth
  const hasGrowth = data.contracted_products.includes('millennials-growth');
  if (hasGrowth) return !!data.assigned_ads_manager;
  return true;
}, {
  message: 'Selecione o Gestor de Ads responsável',
  path: ['assigned_ads_manager'],
}).refine((data) => {
  // Consultor de MKT Place é obrigatório quando o produto envolve MKT Place
  const needsMktplace = data.contracted_products.includes('millennials-growth') ||
    data.contracted_products.includes('gestor-mktplace');
  if (needsMktplace) return !!data.assigned_mktplace;
  return true;
}, {
  message: 'Selecione o Consultor(a) de MKT Place',
  path: ['assigned_mktplace'],
}).refine((data) => {
  // Validar que cada produto selecionado tem um valor
  if (data.contracted_products.length === 0) return true;
  
  for (const product of data.contracted_products) {
    const value = data.product_values[product];
    if (!value || parseCurrency(value) <= 0) {
      return false;
    }
  }
  return true;
}, {
  message: 'Informe o valor mensal para cada produto contratado',
  path: ['product_values'],
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientRegistrationFormProps {
  onSuccess?: () => void;
  compact?: boolean;
}

export default function ClientRegistrationForm({ onSuccess, compact = false }: ClientRegistrationFormProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [overloadDialog, setOverloadDialog] = useState<{
    open: boolean;
    fieldName: string;
    value: string;
    managerName: string;
  }>({ open: false, fieldName: '', value: '', managerName: '' });

  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const [selectedSquadId, setSelectedSquadId] = useState<string>('');
  const { data: squads = [] } = useSquads(selectedGroupId);
  const { data: adsManagers = [], isLoading: managersLoading } = useAdsManagers(selectedSquadId || undefined);
  const { data: comercialConsultants = [], isLoading: consultantsLoading } = useComercialConsultants();
  const { data: crmManagers = [], isLoading: crmLoading } = useCrmManagers();
  const { data: rhUsers = [], isLoading: rhLoading } = useRhUsers();
  const { data: outboundManagers = [], isLoading: outboundLoading } = useOutboundManagers();
  const { data: mktplaceConsultants = [], isLoading: mktplaceLoading } = useMktplaceConsultants();
  const createClient = useCreateClient();

  // Contagens de clientes (mesma lógica da Sidebar)
  const { data: gestorCounts = {} } = useAllGestorClientCounts();
  const { data: treinadorCounts = {} } = useAllTreinadorClientCounts();
  const { data: crmCounts = {} } = useAllCrmClientCounts();
  const { data: outboundCounts = {} } = useAllOutboundClientCounts();
  const { data: mktplaceCounts = {} } = useAllMktplaceClientCounts();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      cnpj: '',
      cpf: '',
      phone: '',
      razao_social: '',
      niche: '',
      general_info: '',
      expected_investment: '',
      product_values: {},
      sales_percentage: 0,
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      contract_duration_months: 0,
      payment_due_day: 10,
      contracted_products: [],
      group_id: '',
      squad_id: '',
      assigned_ads_manager: '',
      assigned_comercial: '',
      assigned_crm: '',
      assigned_rh: '',
      assigned_outbound_manager: '',
      assigned_mktplace: '',
    },
    mode: 'onChange',
  });

  const { isSubmitting } = form.formState;
  
  // Use useMemo to stabilize the products check and prevent infinite loops
  const watchedProducts = form.watch('contracted_products');
  const hasMillennialsGrowth = useMemo(() => {
    return Array.isArray(watchedProducts) && watchedProducts.includes('millennials-growth');
  }, [watchedProducts]);

  const hasMillennialsPaddock = useMemo(() => {
    return Array.isArray(watchedProducts) && watchedProducts.includes('millennials-paddock');
  }, [watchedProducts]);

  const showAdsManager = hasMillennialsGrowth;
  const hasTorqueCRM = useMemo(() => {
    return Array.isArray(watchedProducts) && watchedProducts.includes('torque-crm');
  }, [watchedProducts]);

  const hasHunting = useMemo(() => {
    return Array.isArray(watchedProducts) && watchedProducts.includes('millennials-hunting');
  }, [watchedProducts]);

  const hasOutbound = useMemo(() => {
    return Array.isArray(watchedProducts) && watchedProducts.includes('millennials-outbound');
  }, [watchedProducts]);

  const hasGestorMktplace = useMemo(() => {
    return Array.isArray(watchedProducts) && watchedProducts.includes('gestor-mktplace');
  }, [watchedProducts]);

  const showMktplace = hasMillennialsGrowth || hasGestorMktplace;
  const showComercial = hasMillennialsGrowth || hasMillennialsPaddock || hasTorqueCRM;
  const showCrmManager = hasTorqueCRM;
  const showRhUser = hasHunting;
  const showOutboundManager = hasOutbound;

  // Handler para selects de responsáveis com verificação de limite
  const handleManagerSelect = useCallback((
    fieldName: string,
    value: string,
    counts: Record<string, number>,
    managers: { user_id: string; name: string }[],
    limit: number,
    onChange: (value: string) => void,
  ) => {
    if (!value) {
      onChange(value);
      return;
    }
    const count = counts[value] || 0;
    if (count >= limit) {
      const manager = managers.find(m => m.user_id === value);
      setOverloadDialog({
        open: true,
        fieldName,
        value,
        managerName: manager?.name || 'Responsável',
      });
    } else {
      onChange(value);
    }
  }, []);

  const toggleProduct = useCallback((slug: string, checked: boolean) => {
    const current = form.getValues('contracted_products') || [];
    const currentValues = form.getValues('product_values') || {};
    
    if (checked) {
      form.setValue('contracted_products', [...current, slug], { shouldValidate: true });
    } else {
      form.setValue('contracted_products', current.filter(p => p !== slug), { shouldValidate: true });
      // Remove valor do produto desmarcado
      const { [slug]: removed, ...rest } = currentValues;
      form.setValue('product_values', rest, { shouldValidate: true });
      
      // If unchecking millennials-growth, clear team fields (group/squad only)
      if (slug === 'millennials-growth') {
        form.setValue('group_id', '');
        form.setValue('squad_id', '');
        form.setValue('assigned_ads_manager', '');
        form.setValue('assigned_comercial', '');
        setSelectedGroupId('');
        setSelectedSquadId('');
      }
    }
  }, [form]);

  const onSubmit = async (data: ClientFormData) => {
    const investment = parseCurrency(data.expected_investment);
    
    // Calcular valor mensal total somando todos os produtos
    const productValues = data.product_values || {};
    const totalMonthlyValue = Object.values(productValues).reduce(
      (sum, val) => sum + parseCurrency(val), 
      0
    );

    // Preparar array de valores por produto para salvar
    const productValuesArray = (data.contracted_products || []).map(slug => {
      const product = AVAILABLE_PRODUCTS.find(p => p.slug === slug);
      return {
        product_slug: slug,
        product_name: product?.name || slug,
        monthly_value: parseCurrency(productValues[slug] || '0'),
      };
    });

    try {
      await createClient.mutateAsync({
        name: data.name.trim(),
        cnpj: data.cnpj,
        cpf: data.cpf || undefined,
        phone: data.phone || undefined,
        razao_social: data.razao_social.trim(),
        niche: data.niche.trim(),
        general_info: data.general_info.trim(),
        expected_investment: investment,
        monthly_value: totalMonthlyValue,
        sales_percentage: data.sales_percentage,
        entry_date: data.entry_date,
        contract_duration_months: data.contract_duration_months,
        contracted_products: data.contracted_products,
        payment_due_day: data.payment_due_day,
        group_id: hasMillennialsGrowth ? data.group_id : undefined,
        squad_id: hasMillennialsGrowth ? data.squad_id : undefined,
        assigned_ads_manager: data.assigned_ads_manager || undefined,
        assigned_comercial: data.assigned_comercial || undefined,
        assigned_crm: data.assigned_crm || undefined,
        assigned_rh: data.assigned_rh || undefined,
        assigned_outbound_manager: data.assigned_outbound_manager || undefined,
        assigned_mktplace: data.assigned_mktplace || undefined,
        product_values: productValuesArray,
      });

      // Mostrar mensagem de sucesso
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Limpar formulário
      form.reset();
      setSelectedGroupId('');
      setSelectedSquadId('');

      onSuccess?.();
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };


  return (
    <div className={compact ? "" : "max-w-3xl mx-auto"}>
      <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Cadastro de Novo Cliente</h2>
            <p className="text-sm text-muted-foreground">
              Preencha todos os campos para cadastrar um novo cliente
            </p>
          </div>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">Cliente cadastrado com sucesso!</p>
              <p className="text-xs text-success/80">
                Cards criados automaticamente nos kanbans dos produtos selecionados.
              </p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section: Produtos Contratados */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <Package className="w-4 h-4" />
                Produtos Contratados
              </div>

              <FormField
                control={form.control}
                name="contracted_products"
                render={() => {
                  const products = watchedProducts || [];
                  return (
                    <FormItem>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {AVAILABLE_PRODUCTS.map((product) => {
                          const isSelected = products.includes(product.slug);
                          const id = `product-${product.slug}`;
                          return (
                            <label
                              key={product.slug}
                              htmlFor={id}
                              className={`flex items-center space-x-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-primary/10 border-primary'
                                  : 'bg-muted/30 border-border hover:border-primary/50'
                              }`}
                            >
                              <input
                                id={id}
                                type="checkbox"
                                className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                checked={isSelected}
                                onChange={(e) => toggleProduct(product.slug, e.target.checked)}
                              />
                              <span className="text-sm font-medium cursor-pointer flex-1">
                                {product.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <FormDescription className="text-xs mt-2">
                        Selecione os produtos que o cliente contratou. É possível selecionar vários ou nenhum.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {/* Section: Valores por Produto - Aparece quando há produtos selecionados */}
            {watchedProducts && watchedProducts.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-border animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <DollarSign className="w-4 h-4" />
                  Valor Mensal por Produto
                </div>
                
                <div className="bg-info/5 border border-info/20 rounded-xl p-3 text-xs text-info">
                  Informe o valor mensal que o cliente paga por cada produto contratado.
                </div>

                <div className="space-y-3">
                  {watchedProducts.map((productSlug) => {
                    const product = AVAILABLE_PRODUCTS.find(p => p.slug === productSlug);
                    if (!product) return null;
                    
                    const productValues = form.watch('product_values') || {};
                    const currentValue = productValues[productSlug] || '';
                    
                    return (
                      <div key={productSlug} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                        <div className="flex-1">
                          <span className="text-sm font-medium">{product.name}</span>
                        </div>
                        <div className="relative w-40">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                            R$
                          </span>
                          <Input
                            placeholder="0,00"
                            className="input-apple pl-10 h-9 text-sm"
                            value={currentValue}
                            onChange={(e) => {
                              const newValues = { ...productValues, [productSlug]: formatCurrency(e.target.value) };
                              form.setValue('product_values', newValues, { shouldValidate: true });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Total calculado */}
                {watchedProducts.length > 1 && (
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <span className="text-sm font-semibold text-primary">Valor Mensal Total</span>
                    <span className="text-sm font-bold text-primary">
                      R$ {(() => {
                        const productValues = form.watch('product_values') || {};
                        const total = Object.values(productValues).reduce(
                          (sum, val) => sum + parseCurrency(val), 
                          0
                        );
                        return total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                      })()}
                    </span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="product_values"
                  render={() => (
                    <FormItem>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Section: Identificação */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <Building2 className="w-4 h-4" />
                Identificação do Cliente
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Cliente *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome fantasia ou apelido"
                          className="input-apple"
                          maxLength={100}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {field.value.length}/100 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="razao_social"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo / Razão Social *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Razão social da empresa"
                          className="input-apple"
                          maxLength={255}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {field.value.length}/255 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00.000.000/0000-00"
                          className="input-apple"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          className="input-apple"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCPF(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          className="input-apple"
                          maxLength={15}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section: Informações */}
            <div className="space-y-4 pt-4 border-t border-border">
              <FormField
                control={form.control}
                name="niche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qual o nicho do cliente? *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Restaurante, E-commerce, Clínica, Advocacia..."
                        className="input-apple"
                        maxLength={100}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {field.value.length}/100 caracteres
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="general_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>O que o gestor precisa saber sobre esse cliente? *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalhes importantes, histórico, observações relevantes para o gestor..."
                        className="input-apple min-h-[100px] resize-none"
                        maxLength={1000}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {field.value.length}/1000 caracteres
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="expected_investment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Investimento Previsto *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            R$
                          </span>
                          <Input
                            placeholder="0,00"
                            className="input-apple pl-10"
                            value={field.value}
                            onChange={(e) => field.onChange(formatCurrency(e.target.value))}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sales_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>% Comissão Vendas *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            placeholder="0"
                            className="input-apple pr-8"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            %
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="entry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Data de Entrada *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="input-apple"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Data em que o cliente entrou
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contract_duration_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Duração do Contrato (meses) *
                      </FormLabel>
                      <FormControl>
                        <select
                          className="input-apple"
                          value={field.value || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            field.onChange(isNaN(val) ? 0 : val);
                          }}
                        >
                          <option value="" disabled>Selecione a duração</option>
                          <option value="3">3 meses</option>
                          <option value="6">6 meses</option>
                          <option value="12">12 meses</option>
                          <option value="24">24 meses</option>
                          <option value="36">36 meses</option>
                        </select>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Período de vigência do contrato
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_due_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Dia de Vencimento *
                      </FormLabel>
                      <FormControl>
                        <select
                          className="input-apple"
                          value={field.value || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            field.onChange(isNaN(val) ? 0 : val);
                          }}
                        >
                          <option value="" disabled>Selecione o dia</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                            <option key={day} value={day}>
                              Dia {day}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Dia do mes em que o pagamento vence
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section: Atribuição de Equipe - Só aparece se Millennials Growth estiver selecionado */}
            {hasMillennialsGrowth && (
              <div key="team-assignment-section" className="space-y-4 pt-4 border-t border-border animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Equipe (Millennials Growth)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="group_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo *</FormLabel>
                        <FormControl>
                          <select
                            className="input-apple"
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value);
                              setSelectedGroupId(value);
                              setSelectedSquadId('');
                              form.setValue('squad_id', '');
                              form.setValue('assigned_ads_manager', '');
                              form.setValue('assigned_comercial', '');
                            }}
                          >
                            <option value="" disabled>
                              Selecione um grupo
                            </option>
                            {groupsLoading ? (
                              <option value="" disabled>
                                Carregando...
                              </option>
                            ) : groups.length === 0 ? (
                              <option value="" disabled>
                                Nenhum grupo encontrado
                              </option>
                            ) : (
                              groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))
                            )}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="squad_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Squad *</FormLabel>
                        <FormControl>
                          <select
                            className="input-apple"
                            value={field.value || ''}
                            disabled={!selectedGroupId}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setSelectedSquadId(e.target.value);
                              // Limpar responsáveis ao trocar de squad
                              form.setValue('assigned_ads_manager', '');
                              form.setValue('assigned_comercial', '');
                            }}
                          >
                            <option value="" disabled>
                              {selectedGroupId ? 'Selecione um squad' : 'Selecione um grupo primeiro'}
                            </option>
                            {selectedGroupId && squads.length === 0 ? (
                              <option value="" disabled>
                                Nenhum squad encontrado
                              </option>
                            ) : (
                              squads.map((squad) => (
                                <option key={squad.id} value={squad.id}>
                                  {squad.name}
                                </option>
                              ))
                            )}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Section: Responsáveis - Sempre visível */}
            <div className="space-y-4 pt-4 border-t border-border">
              {(showAdsManager || showComercial || showCrmManager) && (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Responsáveis
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {showAdsManager && (
                      <FormField
                        control={form.control}
                        name="assigned_ads_manager"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gestor de Ads Responsável *</FormLabel>
                            <FormControl>
                              <select
                                className="input-apple"
                                value={field.value || ''}
                                onChange={(e) => handleManagerSelect(
                                  'assigned_ads_manager',
                                  e.target.value,
                                  gestorCounts,
                                  adsManagers,
                                  MANAGER_LIMITS.gestor_ads,
                                  field.onChange,
                                )}
                              >
                                <option value="" disabled>
                                  Selecione um gestor de ads
                                </option>
                                {managersLoading ? (
                                  <option value="" disabled>
                                    Carregando...
                                  </option>
                                ) : adsManagers.length === 0 ? (
                                  <option value="" disabled>
                                    Nenhum gestor encontrado
                                  </option>
                                ) : (
                                  adsManagers.map((manager) => (
                                    <option key={manager.user_id} value={manager.user_id}>
                                      {manager.name} — {gestorCounts[manager.user_id] || 0}/{MANAGER_LIMITS.gestor_ads}
                                    </option>
                                  ))
                                )}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {showComercial && (
                      <FormField
                        control={form.control}
                        name="assigned_comercial"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Treinador Comercial</FormLabel>
                            <FormControl>
                              <select
                                className="input-apple"
                                value={field.value || ''}
                                onChange={(e) => handleManagerSelect(
                                  'assigned_comercial',
                                  e.target.value,
                                  treinadorCounts,
                                  comercialConsultants,
                                  MANAGER_LIMITS.consultor_comercial,
                                  field.onChange,
                                )}
                              >
                                <option value="">Selecione o Treinador Comercial</option>
                                {consultantsLoading ? (
                                  <option value="" disabled>
                                    Carregando...
                                  </option>
                                ) : comercialConsultants.length === 0 ? (
                                  <option value="" disabled>
                                    Nenhum treinador encontrado
                                  </option>
                                ) : (
                                  comercialConsultants.map((consultant) => (
                                    <option key={consultant.user_id} value={consultant.user_id}>
                                      {consultant.name} — {treinadorCounts[consultant.user_id] || 0}/{MANAGER_LIMITS.consultor_comercial}
                                    </option>
                                  ))
                                )}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Consultor(a) de MKT Place */}
                    {showMktplace && (
                      <FormField
                        control={form.control}
                        name="assigned_mktplace"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Consultor(a) de MKT Place</FormLabel>
                            <FormControl>
                              <select
                                className="input-apple"
                                value={field.value || ''}
                                onChange={(e) => handleManagerSelect(
                                  'assigned_mktplace',
                                  e.target.value,
                                  mktplaceCounts,
                                  mktplaceConsultants,
                                  MANAGER_LIMITS.consultor_mktplace,
                                  field.onChange,
                                )}
                              >
                                <option value="">Selecione o Consultor(a) de MKT Place</option>
                                {mktplaceLoading ? (
                                  <option value="" disabled>Carregando...</option>
                                ) : mktplaceConsultants.length === 0 ? (
                                  <option value="" disabled>Nenhum consultor encontrado</option>
                                ) : (
                                  mktplaceConsultants.map((consultant) => (
                                    <option key={consultant.user_id} value={consultant.user_id}>
                                      {consultant.name} — {mktplaceCounts[consultant.user_id] || 0}/{MANAGER_LIMITS.consultor_mktplace}
                                    </option>
                                  ))
                                )}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Gestor de CRM (Torque CRM) */}
                    {showCrmManager && (
                      <FormField
                        control={form.control}
                        name="assigned_crm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gestor de CRM</FormLabel>
                            <FormControl>
                              <select
                                className="input-apple"
                                value={field.value || ''}
                                onChange={(e) => handleManagerSelect(
                                  'assigned_crm',
                                  e.target.value,
                                  crmCounts,
                                  crmManagers,
                                  MANAGER_LIMITS.gestor_crm,
                                  field.onChange,
                                )}
                              >
                                <option value="">Selecione o Gestor de CRM</option>
                                {crmLoading ? (
                                  <option value="" disabled>Carregando...</option>
                                ) : crmManagers.length === 0 ? (
                                  <option value="" disabled>Nenhum Gestor de CRM cadastrado ainda</option>
                                ) : (
                                  crmManagers.map((manager) => (
                                    <option key={manager.user_id} value={manager.user_id}>
                                      {manager.name} — {crmCounts[manager.user_id] || 0}/{MANAGER_LIMITS.gestor_crm}
                                    </option>
                                  ))
                                )}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                  </div>
                </>
              )}
            </div>

            {/* Info box */}
            <div className="bg-info/10 border border-info/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-info">Automação Ativada</p>
                <p className="text-xs text-info/80 mt-1">
                  {hasMillennialsGrowth
                    ? 'Cards serão criados nos kanbans: Gestor de Projetos, Gestor de Ads, Financeiro, Treinador Comercial e nos produtos selecionados.'
                    : watchedProducts.length > 0
                      ? `Cards serão criados no kanban do Gestor de Ads e nos kanbans dos ${watchedProducts.length} produto(s) selecionado(s).`
                      : 'O cliente aparecerá no kanban do Gestor de Ads selecionado.'
                  }
                </p>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || createClient.isPending}
            >
              {createClient.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cadastrando Cliente...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Cadastrar Cliente
                </>
              )}
            </Button>

            {/* Form status */}
            {watchedProducts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Você pode cadastrar um cliente sem produtos, mas nenhum card será criado automaticamente.
              </p>
            )}
          </form>
        </Form>

        {/* Dialog de confirmação para responsável com carteira cheia */}
        <AlertDialog
          open={overloadDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setOverloadDialog(prev => ({ ...prev, open: false }));
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive text-lg font-bold">
                PERIGO.
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-foreground">
                Esse colaborador já possui o número máximo de clientes, tem certeza que quer continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setOverloadDialog(prev => ({ ...prev, open: false }));
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  const { fieldName, value } = overloadDialog;
                  form.setValue(fieldName as any, value, { shouldValidate: true });
                  setOverloadDialog(prev => ({ ...prev, open: false }));
                }}
              >
                Continuar mesmo assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
