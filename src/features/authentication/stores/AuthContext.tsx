import { User } from '@supabase/supabase-js';
import React, { createContext, useEffect, useState } from 'react';

import { supabase } from '../../../config/supabase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Google, not magic-link email -- @u.northwestern.edu accounts run on
  // Google Workspace for Education, so this is real university-backed
  // login rather than a link from an address students don't recognize,
  // and it sends no email of its own (sidesteps Supabase's default email
  // service's very low send-rate limit entirely, which magic-link auth
  // was hitting in practice). `hd` only pre-filters Google's own account
  // picker -- it's a UX nicety, not enforcement, so the real domain check
  // lives server-side in the restrict_signup_to_northwestern_email Auth
  // Hook (see migration 0027) rather than being trusted here.
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/login',
        queryParams: { hd: 'u.northwestern.edu' },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
