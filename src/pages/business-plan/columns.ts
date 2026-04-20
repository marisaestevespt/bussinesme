import { Heart, Users, Package, DollarSign, Megaphone, Receipt, Swords, Layers, type LucideIcon } from 'lucide-react';

export const FIXED_COLUMNS = [
  { key: 'proposta_valor', label: 'Proposta de Valor' },
  { key: 'segmento_mercado', label: 'Segmento de Mercado' },
  { key: 'recursos_chave', label: 'Recursos Chave' },
  { key: 'fonte_receita', label: 'Fonte de Receita' },
  { key: 'canais_divulgacao', label: 'Canais & Divulgação' },
  { key: 'estrutura_custos', label: 'Estrutura de Custos' },
  { key: 'concorrencia', label: 'Concorrência' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  proposta_valor: Heart,
  segmento_mercado: Users,
  recursos_chave: Package,
  fonte_receita: DollarSign,
  canais_divulgacao: Megaphone,
  estrutura_custos: Receipt,
  concorrencia: Swords,
};

export function getColumnIcon(key: string): LucideIcon {
  return ICON_MAP[key] || Layers;
}
