import { cn } from '@/lib/utils';

interface StrategyPlatformSelectorProps {
  metaEnabled: boolean;
  setMetaEnabled: (value: boolean) => void;
  googleEnabled: boolean;
  setGoogleEnabled: (value: boolean) => void;
  linkedinEnabled: boolean;
  setLinkedinEnabled: (value: boolean) => void;
}

export default function StrategyPlatformSelector({
  metaEnabled,
  setMetaEnabled,
  googleEnabled,
  setGoogleEnabled,
  linkedinEnabled,
  setLinkedinEnabled,
}: StrategyPlatformSelectorProps) {
  const platforms = [
    {
      id: 'meta',
      name: 'Meta (Facebook/Instagram)',
      icon: '📘',
      enabled: metaEnabled,
      setEnabled: setMetaEnabled,
      gradient: 'from-blue-500 to-purple-600',
    },
    {
      id: 'google',
      name: 'Google Ads',
      icon: '🔍',
      enabled: googleEnabled,
      setEnabled: setGoogleEnabled,
      gradient: 'from-red-500 to-yellow-500',
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Ads',
      icon: '💼',
      enabled: linkedinEnabled,
      setEnabled: setLinkedinEnabled,
      gradient: 'from-blue-600 to-blue-800',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Selecione as Plataformas</h3>
        <p className="text-sm text-muted-foreground">
          Escolha em quais plataformas os funis serão executados
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            type="button"
            onClick={() => platform.setEnabled(!platform.enabled)}
            className={cn(
              'relative p-5 rounded-xl border-2 transition-all text-left group',
              platform.enabled
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/50'
            )}
          >
            <div className={cn(
              'absolute inset-0 rounded-xl opacity-0 transition-opacity bg-gradient-to-br',
              platform.gradient,
              platform.enabled && 'opacity-5'
            )} />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{platform.icon}</span>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  platform.enabled ? 'border-primary bg-primary' : 'border-muted-foreground'
                )}>
                  {platform.enabled && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="font-semibold text-foreground">{platform.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
