
# Adaptação por Setor de Atividade

## Contexto
O campo `business_type` existente refere-se à forma jurídica (ENI/Empresa). Precisamos de um novo campo `business_sector` que define o **setor de atividade** e adapta toda a experiência.

## Setores suportados
| Chave | Label | Exemplo |
|-------|-------|---------|
| `servicos_digitais` | Serviços Digitais | Gestão redes, design, consultoria, mentoria |
| `saude_bem_estar` | Saúde & Bem-estar | Psicólogas, nutricionistas, esteticistas |
| `educacao_formacao` | Educação & Formação | Formadores, coaches, escolas online |
| `criativo_producao` | Criativo & Produção | Fotografia, vídeo, eventos, wedding planners |

## Fase 1 — Base de dados + Config
1. **Migration**: Adicionar coluna `business_sector` à tabela `business_settings` (default `servicos_digitais`)
2. **Ficheiro de configuração**: Criar `src/lib/sector-config.ts` com mapeamento completo por setor:
   - **Terminologia**: mapa de termos genéricos → termos do setor (ex: `clientes` → `pacientes` para saúde)
   - **Módulos visíveis**: lista de módulos ativos/inativos por setor
   - **Campos específicos**: campos extra que aparecem em formulários por setor
   - **Templates sugeridos**: SOPs/processos pré-configurados por setor

## Fase 2 — Hook + Provider
3. **Hook `useSectorConfig()`**: Expõe terminologia, módulos visíveis e campos do setor atual, lendo de `useBusinessSettings()`
4. **Função `t(key)`**: Traduz termos genéricos para o setor atual (ex: `t('clientes')` → "Pacientes")

## Fase 3 — UI adaptações
5. **Sidebar**: Usar `t()` nos labels dos módulos; esconder módulos inativos para o setor
6. **Páginas**: Substituir strings hardcoded pelos termos do setor nos headers/títulos principais
7. **Settings**: Adicionar selector de setor no tab Identidade (ao lado do business_type)

## Fase 4 — Templates por setor
8. **Setup/Onboarding**: Quando o setor é escolhido, sugerir SOPs, processos e rotinas pré-configurados relevantes

## O que muda por setor (exemplos concretos)

### Terminologia
| Genérico | Serviços Digitais | Saúde & Bem-estar | Educação | Criativo |
|----------|-------------------|--------------------|----------|----------|
| Clientes | Clientes | Pacientes | Alunos | Clientes |
| Produto | Serviço | Especialidade | Programa | Serviço |
| Projeto | Projeto | Acompanhamento | Curso | Projeto |
| Venda | Venda | Consulta | Inscrição | Orçamento |
| Reunião | Reunião | Sessão | Aula | Reunião |

### Módulos
| Módulo | Digital ✅ | Saúde | Educação | Criativo |
|--------|-----------|-------|----------|----------|
| Tráfego Pago | ✅ | ❌ | ⚪ | ⚪ |
| Marketing | ✅ | ⚪ | ⚪ | ✅ |
| CRM/Pipeline | ✅ | ⚪ | ⚪ | ✅ |
| Conteúdos | ✅ | ⚪ | ✅ | ✅ |

(✅ = ativo por defeito, ⚪ = disponível mas opcional, ❌ = escondido por defeito)

### Campos específicos
- **Saúde**: Nº cédula profissional, Especialidade, Seguro profissional
- **Educação**: Plataforma de ensino, Nº certificação DGERT
- **Criativo**: Portfolio URL, Equipamento principal
- **Digital**: Ferramentas utilizadas, Nichos

## Notas técnicas
- O setor é escolhido no onboarding/setup e pode ser mudado nas Definições
- A config é puramente frontend — não muda schema da DB por setor
- Campos específicos por setor usam a tabela `custom_fields` existente ou JSON
