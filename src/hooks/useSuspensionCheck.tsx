import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSuspensionCheck() {
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'suspended')
        .maybeSingle();

      if (mounted) {
        setSuspended(true); // TEMP: forçar ecrã de bloqueio para preview
        setLoading(false);
      }
    };

    check();

    // Re-check every 5 minutes in case status changes
    const interval = setInterval(check, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { suspended, loading };
}
