import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/hooks/useFavorites';
import { useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Map route paths to display title + icon name */
const PAGE_META: Record<string, { title: string; icon: string }> = {
  '/secretaria': { title: 'Secretária', icon: 'LayoutDashboard' },
  '/comeca-aqui': { title: 'Começa Aqui', icon: 'Rocket' },
  '/hub/mural': { title: 'Mural', icon: 'MessageSquare' },
  '/hub-equipa': { title: 'Hub de Equipa', icon: 'UsersRound' },
  '/hub/agenda': { title: 'Agenda de Negócio', icon: 'Calendar' },
  '/hub/reunioes': { title: 'Reuniões', icon: 'Users' },
  '/hub/acessos': { title: 'Acessos', icon: 'Key' },
  '/hub/projetos': { title: 'Projetos', icon: 'FolderKanban' },
  '/hub/processos': { title: 'Processos', icon: 'GitBranch' },
  '/hub/tarefas': { title: 'Tarefas', icon: 'CheckSquare' },
  '/hub/biblioteca': { title: 'Biblioteca', icon: 'BookOpen' },
  '/hub/marketing': { title: 'Marketing', icon: 'Megaphone' },
  '/hub/comercial': { title: 'Comercial', icon: 'ShoppingCart' },
  '/hub/clientes': { title: 'Clientes', icon: 'UserCheck' },
  '/hub/financeiro': { title: 'Contabilidade', icon: 'DollarSign' },
  '/hub/operacao': { title: 'Operação', icon: 'Headphones' },
  '/hub/produtos': { title: 'Produtos', icon: 'Package' },
  '/hub/recursos-humanos': { title: 'Pessoas', icon: 'UsersRound' },
  '/executive': { title: 'Executive Room', icon: 'Crown' },
  '/planeamento': { title: 'Planeamento', icon: 'Target' },
  '/executive/weekly-align': { title: 'Weekly Align', icon: 'CalendarCheck' },
  '/executive/productivity': { title: 'Produtividade & Capacidade', icon: 'Clock' },
  '/executive/business-plan': { title: 'Plano de Negócio', icon: 'Rocket' },
  '/executive/innovation': { title: 'Inovação', icon: 'Lightbulb' },
  '/executive/recommendations': { title: 'Recomendações', icon: 'MessageSquareHeart' },
  '/definicoes': { title: 'Definições', icon: 'Settings' },
  '/gestao-marca': { title: 'Gestão de Marca', icon: 'Heart' },
};

export function FavoriteButton() {
  const location = useLocation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const path = location.pathname;
  const meta = PAGE_META[path];

  // Don't show button on pages without meta (detail pages, auth, etc.)
  if (!meta) return null;

  const fav = isFavorite(path);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Favorito" size="icon"
          className="h-8 w-8"
          onClick={() => toggleFavorite.mutate({ path, title: meta.title, icon: meta.icon })}
        >
          <Star
            className={`h-4 w-4 transition-colors ${fav ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
            strokeWidth={1.5}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</TooltipContent>
    </Tooltip>
  );
}
