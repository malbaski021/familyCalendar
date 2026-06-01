'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  familyId: string;
}

/**
 * Subscribe to INSERT/UPDATE/DELETE on `public.events` scoped to the current
 * family and trigger a router refresh whenever anything changes. The page is
 * a server component, so refreshing re-runs the data fetch and the UI picks
 * up the change without manual cache work.
 *
 * Renders nothing — pure side effect.
 */
export function RealtimeEvents({ familyId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`events:family:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, router]);

  return null;
}
