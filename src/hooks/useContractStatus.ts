import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface ContractInfo {
  clientId: string;
  status: 'loading' | 'not_signed' | 'signed' | 'expiring' | 'expired';
  contractExpiresAt: string | null;
  daysUntilExpiration: number | null;
}

const EXPIRATION_WARNING_DAYS = 30;

export function useContractStatus() {
  // Fetch all onboarding records to check contract signing status
  // NOTE: RLS restricts this table to financeiro/gestor_projetos/ceo.
  // Other roles get empty results — that's OK, we fall back to activeClients.
  const { data: onboardingRecords = [], refetch: refetchOnboarding, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ['contract-onboarding-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_client_onboarding')
        .select('client_id, current_step, contract_expiration_date');

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch all active clients to check contract expiration
  // This table is readable by all authenticated users (RLS: USING(true))
  const { data: activeClients = [], refetch: refetchActive, isLoading: isLoadingActive } = useQuery({
    queryKey: ['contract-active-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .select('client_id, contract_expires_at');

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // 30 seconds
  });

  const isLoading = isLoadingOnboarding || isLoadingActive;

  // Set up realtime subscription for updates
  useEffect(() => {
    const channel = supabase
      .channel('contract-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financeiro_client_onboarding',
        },
        () => {
          refetchOnboarding();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financeiro_active_clients',
        },
        () => {
          refetchActive();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchOnboarding, refetchActive]);

  // Get contract status for a specific client
  const getContractStatus = (clientId: string): ContractInfo => {
    // While queries are still loading, return loading status
    // This prevents flashing "Contrato não assinado" before data arrives
    if (isLoading) {
      return {
        clientId,
        status: 'loading',
        contractExpiresAt: null,
        daysUntilExpiration: null,
      };
    }

    const activeClient = activeClients.find(ac => ac.client_id === clientId);
    const onboardingRecord = onboardingRecords.find(or => or.client_id === clientId);

    // Check if contract is signed using multiple signals:
    // 1. onboarding step === 'contrato_assinado'
    // 2. onboarding has contract_expiration_date set (auto-signed on registration)
    // 3. client exists in financeiro_active_clients (readable by all roles)
    const isContractSigned =
      onboardingRecord?.current_step === 'contrato_assinado' ||
      !!(onboardingRecord as any)?.contract_expiration_date ||
      !!activeClient;

    if (!isContractSigned) {
      return {
        clientId,
        status: 'not_signed',
        contractExpiresAt: null,
        daysUntilExpiration: null,
      };
    }

    // Contract is signed - check expiration
    // Prefer activeClient.contract_expires_at, fall back to onboarding.contract_expiration_date
    const contractExpiresAt =
      activeClient?.contract_expires_at ||
      (onboardingRecord as any)?.contract_expiration_date ||
      null;

    if (!contractExpiresAt) {
      return {
        clientId,
        status: 'signed',
        contractExpiresAt: null,
        daysUntilExpiration: null,
      };
    }

    const expiresAt = new Date(contractExpiresAt);
    const today = new Date();
    const daysUntilExpiration = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiration < 0) {
      return {
        clientId,
        status: 'expired',
        contractExpiresAt,
        daysUntilExpiration,
      };
    }

    if (daysUntilExpiration <= EXPIRATION_WARNING_DAYS) {
      return {
        clientId,
        status: 'expiring',
        contractExpiresAt,
        daysUntilExpiration,
      };
    }

    return {
      clientId,
      status: 'signed',
      contractExpiresAt,
      daysUntilExpiration,
    };
  };

  // Check if contract is signed
  const isContractSigned = (clientId: string): boolean => {
    const status = getContractStatus(clientId);
    return status.status !== 'not_signed';
  };

  // Check if contract is expiring
  const isContractExpiring = (clientId: string): boolean => {
    const status = getContractStatus(clientId);
    return status.status === 'expiring' || status.status === 'expired';
  };

  return {
    getContractStatus,
    isContractSigned,
    isContractExpiring,
    isLoading,
    onboardingRecords,
    activeClients,
  };
}
