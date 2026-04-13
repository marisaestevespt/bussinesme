import { LinkedSopsSection } from '@/components/LinkedSopsSection';

interface Props {
  projectId: string;
  clientId: string | undefined;
  productId?: string | null;
  projectStartDate?: string | null;
}

export function ProjectProcessosTab({ projectId, clientId, productId, projectStartDate }: Props) {
  return (
    <div className="space-y-6">
      {/* Processos e SOPs */}
      <LinkedSopsSection entityType="projeto" entityId={projectId} productId={productId || undefined} clientId={clientId} projectStartDate={projectStartDate} />
    </div>
  );
}
