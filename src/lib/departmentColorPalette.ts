// Notion-style color palette for department badges.
// Each entry maps to a fixed Tailwind class string using semantic tokens
// so it works in both light and dark mode.

export interface PaletteColor {
  key: string;
  label: string;
  badgeClass: string;
  swatchClass: string; // small dot used inside the picker
}

export const DEPARTMENT_COLOR_PALETTE: PaletteColor[] = [
  { key: 'gray',    label: 'Cinza',    badgeClass: 'bg-muted text-foreground border-border',                              swatchClass: 'bg-muted-foreground/40' },
  { key: 'red',     label: 'Vermelho', badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',            swatchClass: 'bg-destructive' },
  { key: 'orange',  label: 'Laranja',  badgeClass: 'bg-warning/20 text-warning border-warning/40',                        swatchClass: 'bg-warning' },
  { key: 'amber',   label: 'Âmbar',    badgeClass: 'bg-warning/15 text-warning border-warning/30',                        swatchClass: 'bg-warning/80' },
  { key: 'yellow',  label: 'Amarelo',  badgeClass: 'bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 border-yellow-400/40', swatchClass: 'bg-yellow-400' },
  { key: 'green',   label: 'Verde',    badgeClass: 'bg-success/15 text-success border-success/30',                        swatchClass: 'bg-success' },
  { key: 'teal',    label: 'Turquesa', badgeClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',  swatchClass: 'bg-teal-500' },
  { key: 'blue',    label: 'Azul',     badgeClass: 'bg-info/15 text-info border-info/30',                                 swatchClass: 'bg-info' },
  { key: 'indigo',  label: 'Índigo',   badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', swatchClass: 'bg-indigo-500' },
  { key: 'violet',  label: 'Violeta',  badgeClass: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30',      swatchClass: 'bg-accent-violet' },
  { key: 'pink',    label: 'Rosa',     badgeClass: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',  swatchClass: 'bg-pink-500' },
  { key: 'brown',   label: 'Castanho', badgeClass: 'bg-amber-800/15 text-warning dark:text-warning border-warning/30', swatchClass: 'bg-amber-800' },
];

export function getPaletteColor(key: string | null | undefined): PaletteColor {
  return DEPARTMENT_COLOR_PALETTE.find(c => c.key === key) || DEPARTMENT_COLOR_PALETTE[0];
}