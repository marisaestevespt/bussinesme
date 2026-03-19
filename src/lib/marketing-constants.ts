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
  { value: 'em_ideia', label: 'Em ideia', color: 'bg-muted text-muted-foreground' },
  { value: 'pronto_para_copy', label: 'Pronto para copy', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  { value: 'em_copy', label: 'Em copy', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'pronto_para_design', label: 'Pronto para design', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' },
  { value: 'em_design', label: 'Em design', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  { value: 'gravar', label: 'Gravar', color: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300' },
  { value: 'editar', label: 'Editar', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  { value: 'aprovacao_final', label: 'Aprovação Final', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'tudo_pronto', label: 'Tudo pronto', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  { value: 'agendado', label: 'Agendado', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
  { value: 'publicado', label: 'Publicado', color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
];

export const FUNNEL_OPTIONS = [
  { value: 'topo', label: 'Topo de Funil' },
  { value: 'meio', label: 'Meio de Funil' },
  { value: 'fundo', label: 'Fundo de Funil' },
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
  { value: 'stories', label: 'Stories' },
  { value: 'longo_youtube', label: 'Longo Youtube' },
  { value: 'vlog', label: 'Vlog' },
  { value: 'email', label: 'Email' },
  { value: 'short_tiktok', label: 'Short TikTok' },
  { value: 'post_linkedin', label: 'Post Linkedin' },
  { value: 'pin', label: 'Pin' },
  { value: 'outro', label: 'Outro' },
];

// Maps channel name (lowercase) to allowed format values
export const CHANNEL_FORMAT_MAP: Record<string, string[]> = {
  instagram: ['carrossel', 'reels', 'estatico', 'stories'],
  facebook: ['carrossel', 'reels', 'estatico', 'stories'],
  youtube: ['longo_youtube', 'vlog'],
  'email marketing': ['email'],
  tiktok: ['short_tiktok'],
  linkedin: ['post_linkedin'],
  pinterest: ['pin'],
};

export function getFormatsForChannels(channelNames: string[]): typeof FORMAT_OPTIONS {
  if (channelNames.length === 0) return FORMAT_OPTIONS;
  const allowed = new Set<string>();
  channelNames.forEach(name => {
    const key = name.toLowerCase();
    const formats = CHANNEL_FORMAT_MAP[key];
    if (formats) formats.forEach(f => allowed.add(f));
  });
  if (allowed.size === 0) return FORMAT_OPTIONS;
  return FORMAT_OPTIONS.filter(f => allowed.has(f.value));
}

export const OBJECTIVE_OPTIONS = [
  { value: 'comentario_palavra', label: 'Comentário c/ palavra' },
  { value: 'click_link', label: 'Click em link' },
  { value: 'comentarios', label: 'Comentários' },
  { value: 'gostos', label: 'Gostos' },
  { value: 'guardados', label: 'Guardados' },
  { value: 'partilhas', label: 'Partilhas' },
  { value: 'respostas', label: 'Respostas' },
];

export function getStatusOption(value: string) {
  return STATUS_OPTIONS.find(s => s.value === value);
}
