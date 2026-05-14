import { Monitor, Wifi, WifiOff, Shield, Upload, HardDrive, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { RecordingHealth, HealthStatus } from '@/hooks/useRecordingHealth';

interface RecordingHealthIndicatorProps {
  health: RecordingHealth;
}

interface HealthCheckRowProps {
  icon: LucideIcon;
  label: string;
  status: HealthStatus;
  message?: string;
}

function HealthCheckRow({ icon: Icon, label, status, message }: HealthCheckRowProps) {
  return (
    <div className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg">
      <Icon
        size={14}
        className={cn(
          'shrink-0 mt-0.5',
          status === 'ok' ? 'text-muted-foreground' : status === 'warning' ? 'text-warning' : 'text-danger',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-foreground">{label}</span>
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              status === 'ok' && 'bg-success',
              status === 'warning' && 'bg-warning',
              status === 'critical' && 'bg-danger',
            )}
          />
        </div>
        {message && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{message}</p>
        )}
      </div>
    </div>
  );
}

export function RecordingHealthIndicator({ health }: RecordingHealthIndicatorProps) {
  const { overall, checks } = health;

  const NetworkIcon = checks.network.status === 'critical' ? WifiOff : Wifi;

  const checkItems: HealthCheckRowProps[] = [
    { icon: Monitor, label: 'Gravador', status: checks.recorder.status, message: checks.recorder.message },
    { icon: NetworkIcon, label: 'Rede', status: checks.network.status, message: checks.network.message },
    { icon: Shield, label: 'Autenticacao', status: checks.auth.status, message: checks.auth.message },
    { icon: Upload, label: 'Upload', status: checks.upload.status, message: checks.upload.message },
    { icon: HardDrive, label: 'Armazenamento', status: checks.storage.status, message: checks.storage.message },
    { icon: Layers, label: 'Fila de chunks', status: checks.chunks.status, message: checks.chunks.message },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'w-1.5 h-1.5 rounded-full cursor-pointer transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            overall === 'ok' && 'bg-success',
            overall === 'warning' && 'bg-warning',
            overall === 'critical' && 'bg-danger',
          )}
          style={{
            animation: overall === 'ok'
              ? 'healthPulseOk 2s ease-in-out infinite'
              : overall === 'warning'
                ? 'healthPulseWarn 1.2s ease-in-out infinite'
                : 'healthPulseCrit 0.6s ease-in-out infinite',
          }}
          aria-label={`Status da gravacao: ${
            overall === 'ok' ? 'saudavel' : overall === 'warning' ? 'atencao' : 'critico'
          }`}
        />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={12}
        align="end"
        className="w-72 p-0 bg-popover border-border rounded-xl shadow-2xl"
      >
        <div className="px-3 pt-3 pb-1.5 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Status da gravacao
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-1.5 pb-2">
          {checkItems.map((check) => (
            <HealthCheckRow
              key={check.label}
              icon={check.icon}
              label={check.label}
              status={check.status}
              message={check.message}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
