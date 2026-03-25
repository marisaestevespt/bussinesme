Team management refactoring (2026-03-25): split 2410-line ExecutiveGestaoEquipa.tsx into modules.

## Refactoring done
- Extracted `useMemberSave` hook, `MemberDialog`, `MemberDetailSheet`, `team-helpers`
- Dashboard now shows RH-only stats: membros ativos, contratos a expirar (30d), pagamentos em atraso
- Removed overload/hours analysis from Gestão (lives only in Produtividade & Capacidade)
- Removed `OverloadTabShared` from TabPerformance (was duplicating Produtividade page)
- Escala mensal stays in Gestão Dashboard (it's RH context)

## Clear separation
- **Gestão de Equipa (Pessoas)**: CRUD membros, contratos, pagamentos, férias, escala, feedback, onboarding
- **Produtividade & Capacidade**: tempo registado, ocupação, interno vs cliente, simulação de contratação, sobrecarga
