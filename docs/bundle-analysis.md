# Bundle Analysis — Lyrata

> Análise estática + build de produção (`vite build`). Para visualização interativa, correr `bunx vite-bundle-visualizer` localmente.

## Top 10 chunks (build de produção)

| # | Chunk | Tamanho | Gzip | Carregado quando |
|---|---|---|---|---|
| 1 | `exceljs.min` | 938 KB | 269 KB | ✅ Lazy: só ao clicar "Export Contabilista" (`exportContabilista.ts` faz `await import('exceljs')`) |
| 2 | `recharts-vendor` | 411 KB | 110 KB | Lazy — carrega quando o utilizador entra em rotas que usam charts (Operacao, Productivity, Financeiro, Marketing Análise, etc.). Manual chunk em `vite.config.ts`. |
| 3 | `GestaoMarca` | 405 KB | 101 KB | ✅ Lazy: rota `/hub/marketing/gestao-marca`. Inclui `emoji-picker-react`. |
| 4 | `native` (pdfjs worker / wasm bundles) | 380 KB | 82 KB | ✅ Lazy: dependência de `pdfjs-dist`, carregada via `await import` em `FloatingAiChat`. |
| 5 | `pdf` (pdfjs-dist core) | 337 KB | 99 KB | ✅ Lazy: `await import("pdfjs-dist")` apenas quando o user anexa PDF no chat AI. |
| 6 | `editor-vendor` (@tiptap/react + dompurify) | 325 KB | 102 KB | Manual chunk. Carrega só nas rotas lazy que usam `RichTextEditor` (~17 páginas). |
| 7 | `index` (entry) | 263 KB | 83 KB | Inicial. Apenas: React app shell, providers, Auth, Setup. |
| 8 | `AppLayout` | 233 KB | 70 KB | Carrega após login (sidebar, layout, widgets globais com Suspense). |
| 9 | `ProdutoDetail` | 211 KB | 54 KB | ✅ Lazy: rota `/hub/produtos/:id`. |
| 10 | `ProjetoDetail` | 200 KB | 45 KB | ✅ Lazy: rota `/hub/projetos/:id`. |

Outros notáveis:
- `supabase-vendor` 197 KB / 52 KB gzip (manual chunk)
- `react-vendor` 164 KB / 54 KB gzip (manual chunk)
- `ExecutivePlaneamento` 157 KB / 34 KB gzip (lazy route)

## Bundle inicial (página em branco até estar interativa)

Os chunks descarregados antes do utilizador interagir são apenas:
- `index` (263 KB)
- `react-vendor` (164 KB)
- `query-vendor` (41 KB)
- `supabase-vendor` (197 KB)

**Total inicial ≈ 665 KB / ≈ 200 KB gzip**, sem nenhuma das libs pesadas (exceljs, pdfjs, recharts, tiptap, emoji-mart) carregadas.

## Estado de lazy-loading das libs pesadas

| Lib | Estado | Confirmação |
|---|---|---|
| **exceljs** | ✅ Dynamic `import()` | `src/lib/exportContabilista.ts:84` `await import('exceljs')` |
| **pdfjs-dist** | ✅ Dynamic `import()` | `src/components/FloatingAiChat.tsx:74` `await import("pdfjs-dist")` |
| **@emoji-mart/*** | ✅ Dynamic `import()` | `src/components/entity-icon/EntityIconPicker.tsx:14-15` |
| **emoji-picker-react** | ✅ Eager mas isolado | Importado em `SortableKanbanItem.tsx`, usado só na rota lazy `GestaoMarca` (chunk próprio de 405 KB). |
| **@tiptap** | ✅ Eager mas isolado | `RichTextEditor` importado em ~17 páginas, todas em `React.lazy()` no `App.tsx`. Manual chunk `editor-vendor`. |
| **recharts** | ✅ Eager mas isolado | Usado em ~19 componentes, todos dentro de rotas lazy. Manual chunk `recharts-vendor`. |
| **xlsx** | ✅ Não usado | Substituído por `exceljs` (lazy). |

## Verificação anti-regressão

Imports de libs pesadas em pontos globais (`App.tsx`, `main.tsx`, `AppLayout.tsx`):
```
$ rg "tiptap|recharts|pdfjs|exceljs|xlsx|emoji" src/App.tsx src/main.tsx src/components/AppLayout.tsx
src/components/AppLayout.tsx:14:// Lazy-load heavy floating widgets (pdfjs, large UI) to keep AppLayout chunk small
```
Apenas um comentário — **zero imports estáticos** de libs pesadas no boot path. ✅

## Como reproduzir

```bash
bun install
bun run build                       # vê tabela de chunks no terminal
bunx vite-bundle-visualizer         # gera dist/stats.html para inspeção visual
```

Procurar regressões:
- Qualquer chunk inicial (`index`, `react-vendor`, `query-vendor`, `supabase-vendor`) que cresça > 30%
- Aparição de `recharts`, `tiptap`, `pdfjs`, `exceljs` ou `emoji` no chunk `index-*.js`

## Conclusão

Bundle saudável. Todas as libs pesadas estão isoladas em chunks próprios, carregados apenas quando necessárias (rotas lazy ou dynamic `import()`). Não há ações de refactor pendentes — manter o padrão atual.
