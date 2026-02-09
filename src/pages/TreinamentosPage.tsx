import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useTrainings, Training } from '@/hooks/useTrainings';
import CreateTrainingModal from '@/components/trainings/CreateTrainingModal';
import TrainingDetailModal from '@/components/trainings/TrainingDetailModal';
import TrainingCard from '@/components/trainings/TrainingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  GraduationCap, 
  Plus, 
  Search,
  BookOpen,
  Repeat,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function TreinamentosPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: trainings = [], isLoading } = useTrainings();

  const filteredTrainings = trainings.filter((training) =>
    training.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    training.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCardClick = (training: Training) => {
    setSelectedTraining(training);
  };

  const handleEdit = () => {
    if (selectedTraining) {
      setEditingTraining(selectedTraining);
      setSelectedTraining(null);
      setShowCreateModal(true);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setEditingTraining(null);
  };

  const stats = [
    { 
      label: 'Total', 
      value: trainings.length, 
      icon: BookOpen 
    },
    { 
      label: 'Recorrentes', 
      value: trainings.filter((t) => t.is_recurring).length, 
      icon: Repeat 
    },
    { 
      label: 'Ativos', 
      value: trainings.length, 
      icon: GraduationCap 
    },
  ];

  return (
    <MainLayout>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  <GraduationCap className="h-6 w-6" />
                  Central de Aprendizado
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight"
                >
                  Treinamentos
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-slate-500 max-w-md"
                >
                  Capacite-se e evolua com a gente
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="group bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6 rounded-xl font-medium"
                >
                  <Plus className="h-6 w-6 mr-2" />
                  Novo Treinamento
                  <ArrowRight className="h-5 w-5 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Button>
              </motion.div>
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-3 gap-4"
            >
              {stats.map((stat, index) => (
                <div 
                  key={stat.label}
                  className="group p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-primary/5 hover:border-primary/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <stat.icon className="h-10 w-10 text-slate-400 group-hover:text-primary transition-colors" />
                    <span className="text-sm text-slate-500">{stat.label}</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="relative max-w-md"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
            <Input
              placeholder="Buscar treinamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-primary transition-all"
            />
          </motion.div>

          {/* Trainings Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filteredTrainings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="p-10 rounded-full bg-slate-100 mb-6">
                <GraduationCap className="h-20 w-20 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Nenhum treinamento encontrado
              </h3>
              <p className="text-slate-500 mb-8 max-w-sm">
                {searchTerm
                  ? 'Tente buscar por outro termo'
                  : 'Crie o primeiro treinamento para começar'}
              </p>
              {!searchTerm && (
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  variant="outline"
                  className="rounded-xl"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Criar Treinamento
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrainings.map((training, index) => (
                <TrainingCard
                  key={training.id}
                  training={training}
                  onClick={() => handleCardClick(training)}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        <CreateTrainingModal
          open={showCreateModal}
          onOpenChange={handleCloseCreateModal}
          editingTraining={editingTraining}
        />

        {selectedTraining && (
          <TrainingDetailModal
            open={!!selectedTraining}
            onOpenChange={(open) => !open && setSelectedTraining(null)}
            training={selectedTraining}
            onEdit={handleEdit}
          />
        )}
      </div>
    </MainLayout>
  );
}
