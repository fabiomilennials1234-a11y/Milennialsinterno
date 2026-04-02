import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export interface JustificationRequest {
  id: string;
  title: string;
  subtitle?: string;
  message: string;
  taskId: string;
  taskTable: string;
  taskTitle: string;
  priority?: 'urgent' | 'high' | 'medium';
  resolve: (justification: string) => void;
}

interface JustificationContextValue {
  requireJustification: (config: Omit<JustificationRequest, 'id' | 'resolve'>) => Promise<string>;
}

const JustificationContext = createContext<JustificationContextValue | null>(null);

export function useActionJustification() {
  const ctx = useContext(JustificationContext);
  if (!ctx) throw new Error('useActionJustification must be used within JustificationProvider');
  return ctx;
}

let justificationIdCounter = 0;

export function JustificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<JustificationRequest[]>([]);
  const [justificationText, setJustificationText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const requireJustification = useCallback((config: Omit<JustificationRequest, 'id' | 'resolve'>): Promise<string> => {
    return new Promise<string>((resolve) => {
      justificationIdCounter++;
      setQueue(prev => [
        ...prev,
        { ...config, id: `aj-${justificationIdCounter}`, resolve },
      ]);
    });
  }, []);

  const current = queue[0] || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || isProcessing || !justificationText.trim() || !user) return;

    setIsProcessing(true);
    try {
      // 1. Create a task_delay_notification record
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: notifRecord } = await supabase
        .from('task_delay_notifications')
        .insert({
          task_id: current.taskId,
          task_table: current.taskTable,
          task_owner_id: user.id,
          task_owner_name: profile?.name || 'Usuário',
          task_owner_role: user.role || 'unknown',
          task_title: current.taskTitle,
          task_due_date: new Date().toISOString(),
        })
        .select('id')
        .single();

      // 2. Create the justification record
      if (notifRecord) {
        await supabase
          .from('task_delay_justifications')
          .insert({
            notification_id: notifRecord.id,
            user_id: user.id,
            user_role: user.role || 'unknown',
            justification: justificationText.trim(),
          });
      }

      // 3. Invalidate queries so the Justificativa column updates
      queryClient.invalidateQueries({ queryKey: ['task-delay-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['task-delay-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['task-delay-justifications-by-role'] });
      queryClient.invalidateQueries({ queryKey: ['all-task-delay-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-task-delay-justifications'] });

      // 4. Resolve the promise so the calling hook can continue
      current.resolve(justificationText.trim());

      // 5. Advance to next item in queue
      setQueue(prev => prev.slice(1));
      setJustificationText('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <JustificationContext.Provider value={{ requireJustification }}>
      {children}

      <Dialog open={!!current} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-lg border-danger/50 bg-card"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {current && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 text-danger">
                  <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center animate-pulse">
                    <AlertTriangle size={28} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl text-danger">
                      {current.title}
                    </DialogTitle>
                    {current.subtitle && (
                      <DialogDescription className="text-muted-foreground">
                        {current.subtitle}
                      </DialogDescription>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg">
                  <p className="text-foreground font-medium">
                    {current.message}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Sua justificativa <span className="text-danger">*</span>
                    </label>
                    <Textarea
                      placeholder="Explique detalhadamente..."
                      value={justificationText}
                      onChange={(e) => setJustificationText(e.target.value)}
                      className={cn(
                        'min-h-[120px] resize-none',
                        !justificationText.trim() && 'border-danger/50'
                      )}
                      maxLength={500}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {justificationText.length}/500 caracteres
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-danger hover:bg-danger/90 text-white"
                    disabled={isProcessing || !justificationText.trim()}
                  >
                    {isProcessing ? 'Salvando...' : 'Enviar Justificativa'}
                  </Button>
                </form>

                {queue.length > 1 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{queue.length - 1} outra{queue.length > 2 ? 's' : ''} justificativa{queue.length > 2 ? 's' : ''} pendente{queue.length > 2 ? 's' : ''}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </JustificationContext.Provider>
  );
}
