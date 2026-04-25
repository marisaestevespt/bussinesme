import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Building2, Phone, CreditCard, StickyNote, Briefcase, FileText, Receipt, Users } from 'lucide-react';
import { FinSetupNegocio } from '@/components/financial/FinSetupNegocio';
import { SettingsFiscal } from './SettingsFiscal';

const SECTIONS = [
  {
    group: 'Negócio',
    items: [
      { id: 'sec-empresa', label: 'Dados da Empresa', icon: Building2 },
      { id: 'sec-contactos', label: 'Contactos', icon: Phone },
      { id: 'sec-pagamentos', label: 'Métodos de Pagamento', icon: CreditCard },
      { id: 'sec-notas', label: 'Notas', icon: StickyNote },
    ],
  },
  {
    group: 'Fiscal',
    items: [
      { id: 'sec-tipo-negocio', label: 'Tipo de Negócio', icon: Briefcase },
      { id: 'sec-identificacao-fiscal', label: 'Identificação Fiscal', icon: FileText },
      { id: 'sec-config-fiscal', label: 'Configuração Fiscal', icon: Receipt },
      { id: 'sec-contabilista-equipa', label: 'Equipa & Contabilista', icon: Users },
    ],
  },
];

export function DadosFiscalLayout() {
  const [activeId, setActiveId] = useState<string>('sec-empresa');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const allIds = SECTIONS.flatMap(s => s.items.map(i => i.id));
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] }
    );
    // observe after a tick so refs render
    const t = setTimeout(() => {
      allIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, []);

  const handleNav = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar lateral */}
      <aside className="hidden md:block w-56 shrink-0 sticky top-20 self-start">
        <nav className="space-y-5">
          {SECTIONS.map(group => (
            <div key={group.group}>
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 font-semibold mb-2 px-3">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = activeId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNav(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-colors text-left',
                          active
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Conteúdo */}
      <div ref={containerRef} className="flex-1 min-w-0 space-y-12">
        <section>
          <FinSetupNegocio />
        </section>
        <section>
          <SettingsFiscal />
        </section>
      </div>
    </div>
  );
}
