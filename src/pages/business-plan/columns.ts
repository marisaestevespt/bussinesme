import { Heart, Users, Package, DollarSign, Megaphone, Receipt, Swords, Zap, Handshake, MessageCircle, Layers, type LucideIcon } from 'lucide-react';

export const FIXED_COLUMNS = [
  { key: 'parcerias_chave', label: 'Parcerias-Chave' },
  { key: 'atividades_chave', label: 'Atividades-Chave' },
  { key: 'recursos_chave', label: 'Recursos-Chave' },
  { key: 'proposta_valor', label: 'Proposta de Valor' },
  { key: 'relacoes_clientes', label: 'Relações com Clientes' },
  { key: 'canais_divulgacao', label: 'Canais' },
  { key: 'segmento_mercado', label: 'Segmentos de Clientes' },
  { key: 'estrutura_custos', label: 'Estrutura de Custos' },
  { key: 'fonte_receita', label: 'Fluxos de Receita' },
  { key: 'concorrencia', label: 'Concorrência' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  parcerias_chave: Handshake,
  atividades_chave: Zap,
  recursos_chave: Package,
  proposta_valor: Heart,
  relacoes_clientes: MessageCircle,
  canais_divulgacao: Megaphone,
  segmento_mercado: Users,
  estrutura_custos: Receipt,
  fonte_receita: DollarSign,
  concorrencia: Swords,
};

export function getColumnIcon(key: string): LucideIcon {
  return ICON_MAP[key] || Layers;
}
