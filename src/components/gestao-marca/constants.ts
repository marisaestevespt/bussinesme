import type { KanbanGroup } from './types';

export const KANBAN_GROUPS: KanbanGroup[] = [
  { key: 'marca_pessoal', label: 'Marca Pessoal', headerBg: 'bg-[hsl(351,30%,94%)] dark:bg-[hsl(351,30%,15%)]', headerText: 'text-[hsl(351,40%,45%)] dark:text-[hsl(351,40%,65%)]', dotBg: '', addColor: 'text-[hsl(351,35%,55%)]' },
  { key: 'mercado', label: 'Mercado', headerBg: 'bg-[hsl(25,35%,93%)] dark:bg-[hsl(25,30%,15%)]', headerText: 'text-[hsl(25,50%,45%)] dark:text-[hsl(25,50%,65%)]', dotBg: '', addColor: 'text-[hsl(25,45%,55%)]' },
  { key: 'posicionamento', label: 'Posicionamento', headerBg: 'bg-[hsl(33,30%,92%)] dark:bg-[hsl(33,25%,15%)]', headerText: 'text-[hsl(33,40%,42%)] dark:text-[hsl(33,40%,62%)]', dotBg: '', addColor: 'text-[hsl(33,35%,52%)]' },
  { key: 'identidade', label: 'Identidade', headerBg: 'bg-[hsl(10,35%,93%)] dark:bg-[hsl(10,30%,15%)]', headerText: 'text-[hsl(10,45%,48%)] dark:text-[hsl(10,45%,65%)]', dotBg: '', addColor: 'text-[hsl(10,40%,55%)]' },
  { key: 'impacto', label: 'Impacto', headerBg: 'bg-[hsl(18,30%,92%)] dark:bg-[hsl(18,25%,15%)]', headerText: 'text-[hsl(18,40%,44%)] dark:text-[hsl(18,40%,64%)]', dotBg: '', addColor: 'text-[hsl(18,35%,54%)]' },
];

export const KANBAN_EMOJIS = ['📄', '📝', '💡', '🎯', '✨', '🧭', '🚀', '🎨', '🌱', '🔥', '⭐', '💎', '🧠', '📌', '📚', '🗺️', '🏆', '❤️', '🌍', '🎤'];