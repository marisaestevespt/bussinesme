import { AppLayout } from '@/components/AppLayout';
import { useParams, Link } from 'react-router-dom';
import { MODULES } from '@/lib/modules';
import type { ModuleKey } from '@/lib/modules';
import { EmptyModulePage } from '@/components/EmptyModulePage';
import { Card, CardContent } from '@/components/ui/card';
import { Palette } from 'lucide-react';

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

const MARKETING_SUBPAGES = [
  { title: 'Gestão de Marca', description: 'Branding, identidade visual e posicionamento', url: '/hub/marketing/gestao-marca', icon: Palette },
];

function MarketingHub() {
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <div className="w-full py-12 px-6 flex items-center justify-center" style={{ background: `hsl(var(--primary))` }}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'hsl(var(--primary-foreground))' }}>
            Marketing e Branding
          </h1>
        </div>
        <div className="max-w-4xl mx-auto w-full px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MARKETING_SUBPAGES.map(page => (
              <Link key={page.url} to={page.url}>
                <Card className="hq-transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer h-full">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="rounded-full bg-primary/10 p-3 shrink-0">
                      <page.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{page.title}</p>
                      <p className="text-xs text-muted-foreground">{page.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function HubPage() {
  const { module } = useParams<{ module: string }>();

  if (module === 'marketing') return <MarketingHub />;

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
