import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function useProfileAvatar() {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const refreshAvatar = useCallback(async (userId: string) => {
    // Invalidate relevant queries to refresh avatar across the app
    queryClient.invalidateQueries({ queryKey: ['users'] });
    
    // Fetch fresh profile data
    const { data } = await supabase
      .from('profiles')
      .select('avatar')
      .eq('user_id', userId)
      .single();
    
    return data?.avatar || null;
  }, [queryClient]);

  return {
    isUploading,
    setIsUploading,
    refreshAvatar,
  };
}
