import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface ContractInfo {
  clientId: string;
  status: 'not_signed' | 'signed' | 'expiring' | 'expired';
  contractExpiresAt: string | null;
  daysUntilExpiration: number | null;
}

const EXPIRATION_WARNING_DAYS = 30;

export function useContractStatus() {
  // Fetch all onboarding records to check contract signing status
  const { data: onboardingRecords = [], refetch: refetchOnboarding } = useQuery({
    queryKey: ['contract-onboarding-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_client_onboarding')
        .select('client_id, current_step');

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch all active clients to check contract expiration
  const { data: activeClients = [], refetch: refetchActive } = useQuery({
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
    // First check if client has signed contract (is in active clients or has contrato_assinado step)
    const activeClient = activeClients.find(ac => ac.client_id === clientId);
    const onboardingRecord = onboardingRecords.find(or => or.client_id === clientId);

    // If not in onboarding or active clients, status is unknown (treat as not signed)
    if (!onboardingRecord && !activeClient) {
      return {
        clientId,
        status: 'not_signed',
        contractExpiresAt: null,
        daysUntilExpiration: null,
      };
    }

    // Check if contract is signed
    const isContractSigned = 
      onboardingRecord?.current_step === 'contrato_assinado' || 
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
    const contractExpiresAt = activeClient?.contract_expires_at;

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
    onboardingRecords,
    activeClients,
  };
}
