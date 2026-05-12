import { EntitySection } from '@/components/layout/entity';
import { ClientPortalSection } from '@/components/client/ClientPortalSection';
import { ClientPortalAuditBlock } from '@/components/clients/ClientPortalAuditBlock';
import { Users } from 'lucide-react';

interface Props {
  resolvedClientId: string;
  clientName: string | null;
  productName: string | null;
  productId: string | null;
}

export function ProjectPortalTab({ resolvedClientId, clientName, productName, productId }: Props) {
  return (
    <>
      <EntitySection title="Portal do Cliente" icon={Users}>
        <ClientPortalSection
          clientId={resolvedClientId}
          clientName={clientName}
          currentProduct={productName}
          productId={productId}
        />
      </EntitySection>
      <ClientPortalAuditBlock clientId={resolvedClientId} />
    </>
  );
}