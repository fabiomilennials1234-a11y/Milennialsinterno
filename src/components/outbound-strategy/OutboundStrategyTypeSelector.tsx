import { cn } from '@/lib/utils';

interface OutboundStrategyTypeSelectorProps {
  prospeccaoAtivaEnabled: boolean;
  setProspeccaoAtivaEnabled: (value: boolean) => void;
  remarketingBaseEnabled: boolean;
  setRemarketingBaseEnabled: (value: boolean) => void;
  ambosEnabled: boolean;
  setAmbosEnabled: (value: boolean) => void;
}

export default function OutboundStrategyTypeSelector({
  prospeccaoAtivaEnabled,
  setProspeccaoAtivaEnabled,
  remarketingBaseEnabled,
  setRemarketingBaseEnabled,
  ambosEnabled,
  setAmbosEnabled,
}: OutboundStrategyTypeSelectorProps) {
  const handleSelect = (type: 'prospeccao' | 'remarketing' | 'ambos') => {
    if (type === 'prospeccao') {
      setProspeccaoAtivaEnabled(!prospeccaoAtivaEnabled);
      if (!prospeccaoAtivaEnabled) {
        setAmbosEnabled(false);
        setRemarketingBaseEnabled(false);
      }
    } else if (type === 'remarketing') {
      setRemarketingBaseEnabled(!remarketingBaseEnabled);
      if (!remarketingBaseEnabled) {
        setAmbosEnabled(false);
        setProspeccaoAtivaEnabled(false);
      }
    } else {
      setAmbosEnabled(!ambosEnabled);
      if (!ambosEnabled) {
        setProspeccaoAtivaEnabled(false);
        setRemarketingBaseEnabled(false);
      }
    }
  };

  const types = [
    {
      id: 'prospeccao' as const,
      name: 'Prospecção Ativa',
      description: 'LinkedIn, Cold Call, Cold Email, WhatsApp',
      icon: '🎯',
      enabled: prospeccaoAtivaEnabled,
      gradient: 'from-orange-500 to-red-600',
    },
    {
      id: 'remarketing' as const,
      name: 'Remarketing de Base',
      description: 'Reativação, Nurturing, Upsell/Cross-sell',
      icon: '🔄',
      enabled: remarketingBaseEnabled,
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      id: 'ambos' as const,
      name: 'Os Dois Juntos',
      description: 'Prospecção Ativa + Remarketing de Base',
      icon: '⚡',
      enabled: ambosEnabled,
      gradient: 'from-purple-500 to-indigo-600',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Selecione o Tipo de Estratégia</h3>
        <p className="text-sm text-muted-foreground">
          Escolha qual abordagem será utilizada para este cliente
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {types.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => handleSelect(type.id)}
            className={cn(
              'relative p-5 rounded-xl border-2 transition-all text-left group',
              type.enabled
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/50'
            )}
          >
            <div className={cn(
              'absolute inset-0 rounded-xl opacity-0 transition-opacity bg-gradient-to-br',
              type.gradient,
              type.enabled && 'opacity-5'
            )} />

            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{type.icon}</span>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  type.enabled ? 'border-primary bg-primary' : 'border-muted-foreground'
                )}>
                  {type.enabled && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="font-semibold text-foreground block">{type.name}</span>
              <span className="text-xs text-muted-foreground">{type.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
