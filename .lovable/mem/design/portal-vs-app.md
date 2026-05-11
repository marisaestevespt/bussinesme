---
name: Portal vs App
description: Tipografia uniforme entre portal e sistema — serif (--font-display) só em headings via global CSS; resto em --font-body (Inter). Sem overrides inline em portal-view.
type: design
---
Portal e sistema partilham exatamente o mesmo tratamento tipográfico:

- **Headings (h1-h6)**: `--font-display` aplicado globalmente via `src/index.css`.
- **Resto do conteúdo**: `--font-body` (Inter).

Ambas as fontes vêm de `business_settings.font_display` / `font_body`, pelo que mudar a identidade visual nas Definições reflete-se igual em portal e app.

**Regra**: nunca aplicar `style={{ fontFamily: 'var(--font-display...' }}` inline em componentes do portal — usar elementos `<h1>`/`<h2>` quando se quer serif.

Layout/densidade do portal continua diferente (hairlines, layout 7/5, eventuais drop-caps), mas tipografia é partilhada e gerida num só sítio.
