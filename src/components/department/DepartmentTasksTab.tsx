import { CheckSquare, CalendarClock } from 'lucide-react';
import DepartmentTarefasSection from './DepartmentTarefasSection';

interface Props {
  department: string;
}

export default function DepartmentTasksTab({ department }: Props) {
  return (
    <div className="h-full overflow-y-auto px-8 py-6 scrollbar-apple">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Tarefas Diarias */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
              <CheckSquare size={16} className="text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Tarefas Diarias</h3>
          </div>
          <DepartmentTarefasSection department={department} type="daily" />
        </section>

        {/* Tarefas Semanais */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
              <CalendarClock size={16} className="text-blue-500" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Tarefas Semanais</h3>
          </div>
          <DepartmentTarefasSection department={department} type="weekly" />
        </section>
      </div>
    </div>
  );
}
