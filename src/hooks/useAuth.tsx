import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonationOptional } from '@/contexts/ImpersonationContext';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  /** True when user has owner OR admin role (use for admin-area gating). */
  isAdminOrOwner: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Check if user is owner - use setTimeout to avoid deadlock
          setTimeout(async () => {
            const { data } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .in('role', ['owner', 'admin']);
            const roles = (data || []).map(r => r.role);
            setIsOwner(roles.includes('owner'));
            setIsAdmin(roles.includes('admin'));
            setLoading(false);
          }, 0);
        } else {
          setIsOwner(false);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isOwner, isAdmin, isAdminOrOwner: isOwner || isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  // While the real Owner is impersonating a member, demote the role flags so
  // that every component gated off useAuth() (sidebar sections, action
  // buttons, owner-only UI, etc.) reflects what the member would actually
  // see. The real user/session are kept intact so queries still authenticate.
  const imp = useImpersonationOptional();
  if (imp?.impersonating) {
    return {
      ...context,
      isOwner: false,
      isAdmin: false,
      isAdminOrOwner: false,
    };
  }
  return context;
}
