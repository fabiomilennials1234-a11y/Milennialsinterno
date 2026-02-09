import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Building2, Loader2, CheckCircle2, AlertCircle, CalendarDays, Package, DollarSign } from 'lucide-react';
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
  useGroups,
  useSquads,
  useAdsManagers,
  useComercialConsultants,
  useCreateClient,
} from '@/hooks/useClientRegistration';
import {
  validateCNPJ,
  validateCPF,
  formatCNPJ,
  formatCPF,
  formatCurrency,
  parseCurrency,
} from '@/lib/validators';

// Lista de produtos disponíveis
const AVAILABLE_PRODUCTS = [
  { slug: 'millennials-growth', name: 'Millennials Growth', requiresTeam: true },
  { slug: 'millennials-outbound', name: 'Millennials Outbound', requiresTeam: false },
  { slug: 'on-demand', name: 'ON Demand', requiresTeam: false },
  { slug: 'catalog-terceirizacao', name: 'Catalog (Terceirização)', requiresTeam: false },
  { slug: 'zydon', name: 'Zydon', requiresTeam: false },
  { slug: 'septem', name: 'Septem', requiresTeam: false },
  { slug: 'vendedor-pastinha-comunidade', name: 'Vendedor Pastinha (Comunidade)', requiresTeam: false },
  { slug: 'b2b-club', name: 'B2B Club', requiresTeam: false },
  { slug: 'forja', name: 'Forja', requiresTeam: false },
  { slug: 'millennials-paddock', name: 'Millennials Paddock', requiresTeam: false },
  { slug: 'vendedor-pastinha-educacional', name: 'Vendedor Pastinha (Educacional)', requiresTeam: false },
  { slug: 'torque-crm', name: 'Torque CRM', requiresTeam: false },
  { slug: 'millennials-hunting', name: 'Millennials Hunting', requiresTeam: false },
  { slug: 'organic', name: 'Organic', requiresTeam: false },
  { slug: 'catalog-saas', name: 'Catalog (SAAS)', requiresTeam: false },
  { slug: 'b2b-summit', name: 'B2B Summit', requiresTeam: false },
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
    .min(1, 'CPF é obrigatório')
    .refine((val) => validateCPF(val), {
      message: 'CPF inválido. Verifique os dígitos.',
    }),
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
  contracted_products: z.array(z.string()).default([]),
  group_id: z.string().optional(),
  squad_id: z.string().optional(),
  assigned_ads_manager: z.string().optional(),
  assigned_comercial: z.string().optional(),
}).refine((data) => {
  // Se Millennials Growth está selecionado, exige group_id, squad_id e assigned_ads_manager
  const hasMillennialsGrowth = data.contracted_products.includes('millennials-growth');
  if (hasMillennialsGrowth) {
    return !!data.group_id && !!data.squad_id && !!data.assigned_ads_manager;
  }
  return true;
}, {
  message: 'Para Millennials Growth, Grupo, Squad e Gestor de Ads são obrigatórios',
  path: ['contracted_products'],
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
  
  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const { data: squads = [] } = useSquads(selectedGroupId);
  const { data: adsManagers = [], isLoading: managersLoading } = useAdsManagers();
  const { data: comercialConsultants = [], isLoading: consultantsLoading } = useComercialConsultants();
  const createClient = useCreateClient();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      cnpj: '',
      cpf: '',
      razao_social: '',
      niche: '',
      general_info: '',
      expected_investment: '',
      product_values: {},
      sales_percentage: 0,
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      contracted_products: [],
      group_id: '',
      squad_id: '',
      assigned_ads_manager: '',
      assigned_comercial: '',
    },
    mode: 'onChange',
  });

  const { isSubmitting } = form.formState;
  
  // Use useMemo to stabilize the products check and prevent infinite loops
  const watchedProducts = form.watch('contracted_products');
  const hasMillennialsGrowth = useMemo(() => {
    return Array.isArray(watchedProducts) && watchedProducts.includes('millennials-growth');
  }, [watchedProducts]);

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
      
      // If unchecking millennials-growth, clear team fields
      if (slug === 'millennials-growth') {
        form.setValue('group_id', '');
        form.setValue('squad_id', '');
        form.setValue('assigned_ads_manager', '');
        setSelectedGroupId('');
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
        cpf: data.cpf,
        razao_social: data.razao_social.trim(),
        niche: data.niche.trim(),
        general_info: data.general_info.trim(),
        expected_investment: investment,
        monthly_value: totalMonthlyValue,
        sales_percentage: data.sales_percentage,
        entry_date: data.entry_date,
        contracted_products: data.contracted_products,
        group_id: hasMillennialsGrowth ? data.group_id : undefined,
        squad_id: hasMillennialsGrowth ? data.squad_id : undefined,
        assigned_ads_manager: hasMillennialsGrowth ? data.assigned_ads_manager : undefined,
        assigned_comercial: data.assigned_comercial || undefined,
        product_values: productValuesArray,
      });

      // Mostrar mensagem de sucesso
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Limpar formulário
      form.reset();
      setSelectedGroupId('');

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
                      <FormLabel>CPF *</FormLabel>
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
                            step={0.5}
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
            </div>

            {/* Section: Atribuição de Equipe - Só aparece se Millennials Growth estiver selecionado */}
            {hasMillennialsGrowth && (
              <div key="team-assignment-section" className="space-y-4 pt-4 border-t border-border animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Atribuição de Equipe (Millennials Growth)
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
                              form.setValue('squad_id', '');
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
                            onChange={(e) => field.onChange(e.target.value)}
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
                          onChange={(e) => field.onChange(e.target.value)}
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
                                {manager.name} ({manager.email})
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
                  name="assigned_comercial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consultor Comercial (Opcional)</FormLabel>
                      <FormControl>
                        <select
                          className="input-apple"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value)}
                        >
                          <option value="">Nenhum (opcional)</option>
                          {consultantsLoading ? (
                            <option value="" disabled>
                              Carregando...
                            </option>
                          ) : comercialConsultants.length === 0 ? (
                            <option value="" disabled>
                              Nenhum consultor encontrado
                            </option>
                          ) : (
                            comercialConsultants.map((consultant) => (
                              <option key={consultant.user_id} value={consultant.user_id}>
                                {consultant.name} ({consultant.email})
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
            )}

            {/* Info box */}
            <div className="bg-info/10 border border-info/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-info">Automação Ativada</p>
                <p className="text-xs text-info/80 mt-1">
                  {hasMillennialsGrowth 
                    ? 'Cards serão criados nos kanbans: Gestor de Projetos, Gestor de Ads, Financeiro, Consultor Comercial e nos produtos selecionados.'
                    : watchedProducts.length > 0
                      ? `Cards serão criados nos kanbans dos ${watchedProducts.length} produto(s) selecionado(s).`
                      : 'Selecione pelo menos um produto para criar cards automaticamente.'
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
      </div>
    </div>
  );
}
