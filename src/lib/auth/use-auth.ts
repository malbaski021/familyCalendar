'use client';

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
};

/**
 * Client-side auth state. Subscribes to Supabase auth state changes so the
 * UI updates immediately on sign-in, sign-out, and token refresh.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        isLoading: false,
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
      });
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
