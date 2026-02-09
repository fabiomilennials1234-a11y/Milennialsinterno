import { useState } from 'react';
import { CreditCard, Receipt, ChevronRight } from 'lucide-react';
import FinanceiroContasPagarModal from './FinanceiroContasPagarModal';
import FinanceiroContasReceberModal from './FinanceiroContasReceberModal';

export default function FinanceiroContasSection() {
  const [isContasPagarOpen, setIsContasPagarOpen] = useState(false);
  const [isContasReceberOpen, setIsContasReceberOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        {/* Card: Contas a Pagar */}
        <div
          onClick={() => setIsContasPagarOpen(true)}
          className="group cursor-pointer rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center">
                <CreditCard size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-red-900 dark:text-red-100">
                  Contas a Pagar
                </h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Fornecedores, equipe e despesas
                </p>
              </div>
            </div>
            <ChevronRight 
              size={20} 
              className="text-red-400 group-hover:translate-x-1 transition-transform" 
            />
          </div>
        </div>

        {/* Card: Contas a Receber */}
        <div
          onClick={() => setIsContasReceberOpen(true)}
          className="group cursor-pointer rounded-xl border-2 border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                <Receipt size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-green-900 dark:text-green-100">
                  Contas a Receber
                </h3>
                <p className="text-sm text-green-600/80 dark:text-green-400/80">
                  Faturamento de clientes
                </p>
              </div>
            </div>
            <ChevronRight 
              size={20} 
              className="text-green-400 group-hover:translate-x-1 transition-transform" 
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <FinanceiroContasPagarModal 
        open={isContasPagarOpen} 
        onOpenChange={setIsContasPagarOpen} 
      />
      <FinanceiroContasReceberModal 
        open={isContasReceberOpen} 
        onOpenChange={setIsContasReceberOpen} 
      />
    </>
  );
}
