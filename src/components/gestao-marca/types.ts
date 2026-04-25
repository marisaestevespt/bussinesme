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
}