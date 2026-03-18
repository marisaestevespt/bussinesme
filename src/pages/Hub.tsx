import { EmptyModulePage } from '@/components/EmptyModulePage';
import { AppLayout } from '@/components/AppLayout';
import { useParams } from 'react-router-dom';
import { MODULES } from '@/lib/modules';
import type { ModuleKey } from '@/lib/modules';

const HUB_MODULE_MAP: Record<string, ModuleKey> = {
  agenda: 'agenda',
  reunioes: 'reunioes',
  processos: 'processos',
  projetos: 'projetos',
  tarefas: 'tarefas',
  acessos: 'acessos',
  mural: 'mural',
  administrativo: 'administrativo',
  marketing: 'marketing',
  financeiro: 'financeiro',
  comercial: 'comercial',
  clientes: 'clientes',
  equipa: 'equipa',
  operacao: 'operacao',
};

export default function HubPage() {
  const { module } = useParams<{ module: string }>();
  const moduleKey = module ? HUB_MODULE_MAP[module] : undefined;
  const moduleInfo = moduleKey ? MODULES[moduleKey] : undefined;

  return (
    <AppLayout>
      <EmptyModulePage
        title={moduleInfo?.label || 'Hub de Equipa'}
        description={`Módulo ${moduleInfo?.label || module} será construído em breve.`}
      />
    </AppLayout>
  );
}
