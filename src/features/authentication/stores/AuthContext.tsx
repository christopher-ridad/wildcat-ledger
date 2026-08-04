import { User } from '@supabase/supabase-js';
import React, { createContext, useEffect, useState } from 'react';

import { supabase } from '../../../config/supabase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sendLoginLink: (email: string) => Promise<void>;
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

  const sendLoginLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/login' },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, sendLoginLink }}>
      {children}
    </AuthContext.Provider>
  );
};
