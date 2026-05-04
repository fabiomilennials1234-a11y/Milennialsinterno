import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import JustificativaItem from './JustificativaItem';
import ComentarioMaster from './ComentarioMaster';
import CobrarButton from './CobrarButton';
import type { TeamItem } from '@/hooks/useJustificativas';

interface Props {
  userId: string;
  userName: string;
  userRole: string;
  items: TeamItem[];
}

export default function PessoaAccordion({ userId, userName, userRole, items }: Props) {
  const pendentes = items.filter((i) => !i.justification_id || i.requires_revision);
  const justificadas = items.filter((i) => i.justification_id && !i.requires_revision);

  return (
    <Accordion type="single" collapsible className="border rounded-lg bg-card">
      <AccordionItem value={userId} className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center justify-between w-full pr-2">
            <div className="text-left">
              <p className="font-semibold">{userName}</p>
              <p className="text-xs text-muted-foreground">{userRole}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-danger font-medium">{pendentes.length} pendentes</span>
              <span className="text-muted-foreground">{justificadas.length} justificadas</span>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-3">
          {items.map((it) => (
            <JustificativaItem
              key={`${it.notification_id}-${it.justification_id ?? 'pending'}`}
              title={it.task_title}
              dueDate={it.task_due_date}
              state={
                it.archived ? 'archived'
                : it.requires_revision ? 'revision'
                : it.justification_id ? 'done'
                : 'pending'
              }
              justificationText={it.justification_text ?? undefined}
              masterComment={it.master_comment}
            >
              <div className="flex flex-wrap gap-2">
                {!it.justification_id && <CobrarButton notificationId={it.notification_id} />}
                {it.justification_id && (
                  <ComentarioMaster
                    justificationId={it.justification_id}
                    archived={it.archived}
                    initialComment={it.master_comment}
                  />
                )}
              </div>
            </JustificativaItem>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
