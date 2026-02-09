import { useState } from 'react';
import { useCompanyContent, useUpdateCompanyContent } from '@/hooks/useAdsManager';
import { useAuth } from '@/contexts/AuthContext';
import { Gift, Quote, Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function AdsBonusLemasSection() {
  const { data: content = [], isLoading } = useCompanyContent();
  const updateContent = useUpdateCompanyContent();
  const { isCEO } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [openBonus, setOpenBonus] = useState(false);
  const [openLemas, setOpenLemas] = useState(false);

  const bonusContent = content.find(c => c.slug === 'bonus');
  const lemasContent = content.find(c => c.slug === 'lemas');

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setEditText(item.content || '');
  };

  const handleSave = async (id: string) => {
    await updateContent.mutateAsync({ id, content: editText });
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bônus */}
      <Collapsible open={openBonus} onOpenChange={setOpenBonus}>
        <div className={cn(
          'bg-card border border-border rounded-lg overflow-hidden',
          editingId === bonusContent?.id && 'border-primary'
        )}>
          <CollapsibleTrigger className="w-full">
            <div className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <Gift className="text-amber-400" size={18} />
                <span className="font-semibold text-sm">Bônus Millennials</span>
              </div>
              {openBonus ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 border-t border-border">
              {editingId === bonusContent?.id ? (
                <div className="space-y-2 pt-3">
                  <Textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    placeholder="Descreva a tabela de bônus..."
                    className="min-h-[100px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(bonusContent!.id)}>
                      <Save size={12} className="mr-1" />
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X size={12} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-3">
                  <div className="p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg">
                    {bonusContent?.content ? (
                      <p className="text-xs whitespace-pre-wrap">{bonusContent.content}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center">
                        Tabela de bônus
                      </p>
                    )}
                  </div>
                  {isCEO && bonusContent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full"
                      onClick={() => handleEdit(bonusContent)}
                    >
                      <Edit2 size={12} className="mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Lemas */}
      <Collapsible open={openLemas} onOpenChange={setOpenLemas}>
        <div className={cn(
          'bg-card border border-border rounded-lg overflow-hidden',
          editingId === lemasContent?.id && 'border-primary'
        )}>
          <CollapsibleTrigger className="w-full">
            <div className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <Quote className="text-slate-400" size={18} />
                <span className="font-semibold text-sm">Lemas</span>
              </div>
              {openLemas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 border-t border-border">
              {editingId === lemasContent?.id ? (
                <div className="space-y-2 pt-3">
                  <Textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    placeholder="Descreva os lemas..."
                    className="min-h-[100px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(lemasContent!.id)}>
                      <Save size={12} className="mr-1" />
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X size={12} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-3">
                  <div className="p-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-lg">
                    {lemasContent?.content ? (
                      <p className="text-xs whitespace-pre-wrap">{lemasContent.content}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center">
                        Lemas da empresa
                      </p>
                    )}
                  </div>
                  {isCEO && lemasContent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full"
                      onClick={() => handleEdit(lemasContent)}
                    >
                      <Edit2 size={12} className="mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Note for non-CEO users */}
      {!isCEO && (
        <div className="p-2 bg-muted/30 border border-border rounded-lg text-center">
          <p className="text-[10px] text-muted-foreground">
            Gerenciado pelo CEO
          </p>
        </div>
      )}
    </div>
  );
}
