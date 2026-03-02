import { createContext, useContext, ReactNode } from 'react';

interface OutboundManagerContextType {
  targetUserId: string | undefined;
}

const OutboundManagerContext = createContext<OutboundManagerContextType>({ targetUserId: undefined });

export function OutboundManagerProvider({
  children,
  targetUserId
}: {
  children: ReactNode;
  targetUserId: string | undefined
}) {
  return (
    <OutboundManagerContext.Provider value={{ targetUserId }}>
      {children}
    </OutboundManagerContext.Provider>
  );
}

/**
 * Hook to get the target user ID for the Outbound manager page.
 * If viewing an individual manager's page, returns their ID.
 * Otherwise, returns the logged-in user's ID (for their own page).
 */
export function useTargetOutboundManager() {
  return useContext(OutboundManagerContext);
}
