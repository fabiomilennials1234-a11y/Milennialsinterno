import { Training, ROLE_OPTIONS, WEEKDAY_OPTIONS } from '@/hooks/useTrainings';
import { Badge } from '@/components/ui/badge';
import { 
  GraduationCap, 
  Clock, 
  Calendar, 
  Users, 
  Repeat,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TrainingCardProps {
  training: Training;
  onClick: () => void;
  index: number;
}

export default function TrainingCard({ training, onClick, index }: TrainingCardProps) {
  const getDayLabel = (dayValue: string) => {
    return WEEKDAY_OPTIONS.find((d) => d.value === dayValue)?.label || dayValue;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 cursor-pointer",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        "transition-all duration-300"
      )}
    >
      {/* Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary to-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Content */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <GraduationCap className="h-9 w-9 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">
                {training.title}
              </h3>
              {training.description && (
                <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">
                  {training.description}
                </p>
              )}
            </div>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
            <ArrowRight className="h-7 w-7 text-primary" />
          </div>
        </div>

        {/* Info */}
        <div className="flex items-center gap-4 text-sm text-slate-500">
          {training.class_time && (
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6" />
              <span>{training.class_time}</span>
            </div>
          )}

          {training.is_recurring ? (
            <div className="flex items-center gap-2">
              <Repeat className="h-6 w-6" />
              <span>Recorrente</span>
            </div>
          ) : training.class_date ? (
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              <span>{format(new Date(training.class_date), "dd/MM", { locale: ptBR })}</span>
            </div>
          ) : null}
        </div>

        {/* Recurrence Days */}
        {training.is_recurring && training.recurrence_days && training.recurrence_days.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {training.recurrence_days.map((day) => (
              <Badge 
                key={day} 
                variant="secondary" 
                className="bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary text-xs font-medium"
              >
                {getDayLabel(day).slice(0, 3)}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5 text-sm text-slate-500">
            <Users className="h-6 w-6" />
            {training.allowed_roles && training.allowed_roles.length > 0 ? (
              <span>{training.allowed_roles.length} cargo(s)</span>
            ) : (
              <span className="text-primary font-medium">Todos</span>
            )}
          </div>

          <span className="text-xs font-medium text-slate-400 group-hover:text-primary transition-colors">
            Ver Aulas →
          </span>
        </div>
      </div>
    </motion.div>
  );
}
