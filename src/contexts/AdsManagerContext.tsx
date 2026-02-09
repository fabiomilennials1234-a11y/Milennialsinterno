import { createContext, useContext, ReactNode } from 'react';

interface AdsManagerContextType {
  targetUserId: string | undefined;
}

const AdsManagerContext = createContext<AdsManagerContextType>({ targetUserId: undefined });

export function AdsManagerProvider({ 
  children, 
  targetUserId 
}: { 
  children: ReactNode; 
  targetUserId: string | undefined 
}) {
  return (
    <AdsManagerContext.Provider value={{ targetUserId }}>
      {children}
    </AdsManagerContext.Provider>
  );
}

/**
 * Hook to get the target user ID for the ADS manager page.
 * If viewing an individual manager's page, returns their ID.
 * Otherwise, returns the logged-in user's ID (for their own page).
 */
export function useTargetAdsManager() {
  return useContext(AdsManagerContext);
}
