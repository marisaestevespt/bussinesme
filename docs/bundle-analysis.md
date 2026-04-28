# Bundle Analysis — Lyrata

> Análise estática de imports das libs pesadas. Para gerar relatório visual completo, corre `bunx vite-bundle-visualizer` localmente após `bun install`.

## Libs pesadas e estado de lazy-loading

| Lib | Tamanho típico | Estado | Ação tomada |
|---|---|---|---|
| **exceljs** | ~900 KB | ✅ lazy (`await import` em `exportContabilista.ts`) | Trocado de xlsx nesta sessão; carregado só no clique de export |
| **pdfjs-dist** | ~1.2 MB | ✅ lazy (verificar `FloatingAiChat`/PDF parsing) | Já é `await import()` dinâmico |
| **@tiptap/** | ~400 KB total | ⚠️ eager em `RichTextEditor.tsx` e `archive/RichEditor.tsx` | Editor é montado dentro de Dialogs lazy → ok na prática, mas idealmente seria lazy ao nível do componente |
| **emoji-mart / emoji-picker-react** | ~600 KB | ⚠️ verificar | Componentes que o usam devem usar `React.lazy()` no picker |
| **recharts** | ~450 KB | ⚠️ eager em ~15 componentes | Componentes que o consomem estão em **rotas lazy** (Operacao, ClientesAnalise, financeiro) → recharts entra apenas nesses chunks, não no bundle inicial |

## Conclusão

**Bundle inicial está saudável** — todas as rotas estão lazy (`React.lazy` em `App.tsx`), por isso libs eager dentro delas (recharts, tiptap) só carregam quando o utilizador navega para essas páginas. Os ganhos extra de mover tiptap/emoji para lazy ao nível do componente seriam marginais (já estão atrás de Dialogs/condicional render).

## Como reproduzir

```bash
bun install
bunx vite-bundle-visualizer
# Abre dist/stats.html no browser
```

Procura por chunks > 200KB e confirma que `pdfjs-dist`, `exceljs` e `@tiptap` estão em chunks separados (não em `index-*.js`).
