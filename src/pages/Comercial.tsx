import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Target, ShoppingCart, Zap, Users, Lightbulb, BookOpen } from 'lucide-react';
import { CommercialOverview } from '@/components/commercial/CommercialOverview';
import { Separator } from '@/components/ui/separator';

const SECTIONS = [
  { key: 'metas', label: 'Metas Comerciais', description: 'Meta anual, por produto, trimestre e mês com validações.', icon: Target, color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10', iconColor: 'text-emerald-600' },
  { key: 'vendas', label: 'Vendas', description: 'Registo e gestão de todas as vendas com ID automático.', icon: ShoppingCart, color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10', iconColor: 'text-violet-600' },
  { key: 'acoes', label: 'Ações de Vendas', description: 'Planeamento de ações comerciais e follow-ups.', icon: Zap, color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10', iconColor: 'text-amber-600' },
  { key: 'crm', label: 'CRM', description: 'Gestão de contactos, leads e pipeline comercial.', icon: Users, color: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10', iconColor: 'text-rose-600' },
  { key: 'estrategia', label: 'Estratégia', description: 'Estratégia comercial, posicionamento e planos de ação.', icon: Lightbulb, color: 'from-cyan-500/10 to-cyan-600/5 hover:from-cyan-500/20 hover:to-cyan-600/10', iconColor: 'text-cyan-600' },
  { key: 'biblioteca', label: 'Biblioteca', description: 'Recursos, templates e documentos do departamento.', icon: BookOpen, color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10', iconColor: 'text-orange-600' },
];

export default function ComercialPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comercial</h1>
          <p className="text-muted-foreground mt-1">Gestão comercial, vendas e metas do negócio.</p>
        </div>

        {/* Navigation cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Áreas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTIONS.map(s => (
              <Card
                key={s.key}
                className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                onClick={() => navigate(`/hub/comercial/${s.key}`)}
              >
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className={`h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center shadow-sm ${s.iconColor}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{s.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Visão Geral inline */}
        <CommercialOverview />
                key={s.key}
                className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                onClick={() => navigate(`/hub/comercial/${s.key}`)}
              >
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className={`h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center shadow-sm ${s.iconColor}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{s.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
