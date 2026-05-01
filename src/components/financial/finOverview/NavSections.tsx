import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import type { SectionDef } from './sections';

interface Props { sections: SectionDef[]; }

export function NavRow({ sections }: Props) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {sections.map(s => (
        <Card
          key={s.path}
          className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
          onClick={() => navigate(s.path)}
        >
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <span className="font-medium text-xs sm:text-sm text-foreground leading-tight">{s.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}