import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

/**
 * Returns the "effective" identity to use for data queries and ownership
 * checks. While the real owner is impersonating a member, this returns the
 * impersonated member's user_id / profile_id and treats them as a regular
 * member (isOwner = false, isAdminOrOwner = false), so the preview reflects
 * exactly what that member would see and be able to do.
 */
export function useEffectiveUser() {
  const { user, isOwner, isAdmin, isAdminOrOwner } = useAuth();
  const { impersonating } = useImpersonation();

  if (impersonating) {
    return {
      userId: impersonating.user_id ?? null,
      profileId: impersonating.profile_id ?? null,
      memberId: impersonating.member_id,
      isOwner: false,
      isAdmin: false,
      isAdminOrOwner: false,
      impersonating: true as const,
      realUserId: user?.id ?? null,
    };
  }

  return {
    userId: user?.id ?? null,
    profileId: null as string | null,
    memberId: null as string | null,
    isOwner,
    isAdmin,
    isAdminOrOwner,
    impersonating: false as const,
    realUserId: user?.id ?? null,
  };
}