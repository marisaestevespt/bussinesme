import { createContext } from 'react';

export interface ImpersonatedMember {
  member_id: string;
  user_id: string | null;
  profile_id: string | null;
  full_name: string;
  role_title: string | null;
}

export interface ImpersonationContextType {
  impersonating: ImpersonatedMember | null;
  loading: boolean;
  startImpersonation: (memberId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

export const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);