
## Templates Avançados por Setor de Atividade

### Contexto
O sistema atual adapta terminologia e visibilidade de módulos por setor. Vamos expandir para 4 níveis de personalização e adicionar o setor **Consultoria & Jurídico**.

---

### Fase 1 — Novo Setor + Terminologia Reforçada
- Adicionar setor `consultoria_juridico` ao `sector-config.ts`
- Terminologia: Clientes→Clientes/Mandantes, Projetos→Processos/Casos, Vendas→Avenças, Reuniões→Consultas, Propostas→Pareceres
- Definir módulos visíveis/ocultos para o setor (ex: esconder tráfego pago, marketing de conteúdos)

### Fase 2 — Campos e Layouts Diferenciados
- Expandir `sectorSpecificFields` no config com campos únicos por setor:
  - **Saúde**: Cédula profissional, especialidade, nº ordem
  - **Educação**: Área de formação, certificação DGERT, plataforma e-learning
  - **Criativo**: Portfolio URL, equipamento principal, estilo artístico
  - **Consultoria/Jurídico**: Nº cédula OA, área de prática, tribunal competente, nº processo
- Estes campos aparecem dinamicamente nos formulários de cliente, produto e projeto

### Fase 3 — Workflows e Automações por Setor
- Criar configuração `sectorWorkflows` no config com:
  - Stages do pipeline CRM customizados por setor (ex: Jurídico: Consulta Inicial → Análise → Parecer → Proposta → Avença)
  - Rotinas automáticas sugeridas por setor (ex: Saúde: follow-up pós-consulta a 48h)
  - Tipos de reunião/evento por setor
- A UI adapta os pipelines e sugestões de rotinas com base no setor

### Fase 4 — Templates de Dados Pré-preenchidos (Seed por Setor)
- Ao selecionar/alterar o setor nas definições, oferecer botão "Aplicar templates do setor"
- Cada setor inclui templates para:
  - **SOPs**: 3-5 SOPs típicos do setor
  - **Categorias financeiras**: Categorias de despesa e receita relevantes
  - **Processos departamentais**: Processos-tipo por área
  - **Rotinas sugeridas**: Rotinas recorrentes comuns no setor
- Os templates são **aditivos** (não apagam dados existentes) e marcados como "template" para fácil identificação
- Dados dos templates definidos em ficheiro JSON/TS separado por setor

---

### Arquitetura Técnica
- `src/lib/sector-config.ts` → expande para incluir campos, workflows e referências aos templates
- `src/lib/sector-templates/` → pasta com dados de seed por setor (SOPs, categorias, processos)
- Componente `SectorTemplateApplier` → UI para preview e aplicação dos templates
- Sem alterações de schema na DB (os dados usam as tabelas existentes)
- Zero impacto na performance — tudo é config estática carregada on-demand

### Ordem de Implementação
1. Fase 1 (rápida, ~1 mensagem)
2. Fase 2 (moderada, ~1-2 mensagens)
3. Fase 3 (moderada, ~2 mensagens)
4. Fase 4 (mais complexa, ~2-3 mensagens)
