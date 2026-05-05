export interface KanbanGroup {
  key: string;
  label: string;
  headerBg: string;
  headerText: string;
  dotBg: string;
  addColor: string;
}

export interface KanbanItem {
  id: string;
  group_key: string;
  title: string;
  content: string | null;
  sort_order: number;
  emoji?: string | null;
  is_system?: boolean;
}

export interface KanbanSection {
  id: string;
  item_id: string;
  title: string;
  content: string | null;
  sort_order: number;
}

export interface BrandCompetitor {
  id: string;
  name: string;
  type: string;
  instagram: string | null;
  website: string | null;
  produtos: string | null;
  precos: string | null;
  plataformas: string | null;
  posicionamento: string | null;
  comunicacao: string | null;
  sort_order: number;
}

export interface BrandLink {
  id: string;
  type: string;
  label: string;
  url: string;
  sort_order: number;
}

export interface VisualCard {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
}

export interface VisualFile {
  id: string;
  card_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}