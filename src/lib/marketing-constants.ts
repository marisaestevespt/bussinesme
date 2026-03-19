// Marketing module shared constants and types

export interface ContentItem {
  id: string; title: string; scheduled_at: string | null; status: string;
  funnel_stage: string | null; content_type: string | null; format: string | null;
  objective: string | null; product_name: string | null; project_id: string | null;
  assigned_to: string | null; copy_content: string | null; cover_url: string | null;
  created_by: string | null;
}

export interface MarketingChannel {
  id: string; name: string; link: string | null; is_active: boolean; sort_order: number;
}

export interface ContentChannelLink {
  id: string; content_id: string; channel_id: string;
}

export interface ContentAttachment {
  id: string; content_id: string; file_url: string; file_name: string; file_type: string;
}

export const STATUS_OPTIONS = [
  { value: 'por_planear', label: 'Por planear', color: 'bg-muted text-muted-foreground' },
  { value: 'a_produzir', label: 'A produzir', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'gravar', label: 'Gravar', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  { value: 'editar', label: 'Editar', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  { value: 'agendado', label: 'Agendado', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
  { value: 'publicado', label: 'Publicado', color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
];

export const FUNNEL_OPTIONS = [
  { value: 'topo', label: 'Topo' },
  { value: 'meio_nutricao', label: 'Meio — Nutrição' },
  { value: 'meio_conversao', label: 'Meio — Conversão' },
  { value: 'fundo', label: 'Fundo' },
  { value: 'posicionamento', label: 'Posicionamento' },
];

export const CONTENT_TYPE_OPTIONS = [
  { value: 'educacao', label: 'Educação' },
  { value: 'venda', label: 'Venda' },
  { value: 'identificacao', label: 'Identificação' },
  { value: 'posicionamento', label: 'Posicionamento' },
  { value: 'entretenimento', label: 'Entretenimento' },
];

export const FORMAT_OPTIONS = [
  { value: 'reels', label: 'Reels' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'estatico', label: 'Estático' },
  { value: 'longo_youtube', label: 'Longo Youtube' },
  { value: 'stories', label: 'Stories' },
  { value: 'email', label: 'Email' },
  { value: 'outro', label: 'Outro' },
];

export const OBJECTIVE_OPTIONS = [
  { value: 'comentarios', label: 'Comentários' },
  { value: 'partilhas', label: 'Partilhas' },
  { value: 'guardados', label: 'Guardados' },
  { value: 'cliques', label: 'Cliques' },
  { value: 'leads', label: 'Leads' },
  { value: 'vendas', label: 'Vendas' },
];

export function getStatusOption(value: string) {
  return STATUS_OPTIONS.find(s => s.value === value);
}
