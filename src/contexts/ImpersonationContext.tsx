import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ImpersonatedMember {
  member_id: string;
  user_id: string | null;
  profile_id: string | null;
  full_name: string;
  role_title: string | null;
}

interface ImpersonationContextType {
  /** When set, the app should render permissions/queries as this member. */
  impersonating: ImpersonatedMember | null;
  loading: boolean;
  startImpersonation: (memberId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const STORAGE_KEY = 'lirah_impersonation';

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user, isOwner } = useAuth();
  const [impersonating, setImpersonating] = useState<ImpersonatedMember | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore from sessionStorage on mount (only for owners)
  useEffect(() => {
    if (!isOwner) {
      setImpersonating(null);
      setSessionId(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.member?.member_id) {
          setImpersonating(parsed.member);
          setSessionId(parsed.sessionId ?? null);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [isOwner]);

  const startImpersonation = useCallback(async (memberId: string) => {
    if (!isOwner || !user) return;
    setLoading(true);
    try {
      const { data: member, error } = await supabase
        .from('team_members')
        .select('id, full_name, role_title, profile_id')
        .eq('id', memberId)
        .maybeSingle();
      if (error || !member) throw error || new Error('Membro não encontrado');

      let userId: string | null = null;
      if (member.profile_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', member.profile_id)
          .maybeSingle();
        userId = profile?.user_id ?? null;
      }

      const next: ImpersonatedMember = {
        member_id: member.id,
        user_id: userId,
        profile_id: member.profile_id ?? null,
        full_name: member.full_name,
        role_title: member.role_title,
      };

      // Audit log
      const { data: log } = await supabase
        .from('impersonation_sessions')
        .insert({ owner_user_id: user.id, target_member_id: member.id })
        .select('id')
        .maybeSingle();

      setImpersonating(next);
      setSessionId(log?.id ?? null);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ member: next, sessionId: log?.id ?? null }));
    } finally {
      setLoading(false);
    }
  }, [isOwner, user]);

  const stopImpersonation = useCallback(async () => {
    if (sessionId) {
      await supabase
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
    setImpersonating(null);
    setSessionId(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, [sessionId]);

  return (
    <ImpersonationContext.Provider value={{ impersonating, loading, startImpersonation, stopImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}

/**
 * Non-throwing variant — safe to call from providers/hooks that may render
 * outside the ImpersonationProvider (e.g. useAuth, which sits above it in
 * the tree). Returns null when the provider is not mounted.
 */
export function useImpersonationOptional() {
  return useContext(ImpersonationContext) ?? null;
}
