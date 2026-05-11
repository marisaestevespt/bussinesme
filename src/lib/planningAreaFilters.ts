type ObjectiveLike = { id?: string | null; area?: string | null };
type GoalLike = { objective_id?: string | null; area?: string | null };

const DEPARTMENT_TO_PLAN_AREA: Record<string, string> = {
  'recursos-humanos': 'equipa',
  equipa: 'equipa',
  produtos: 'produtos',
  admin: 'geral',
};

export function planningAreaForDepartment(departmentKey: string): string {
  return DEPARTMENT_TO_PLAN_AREA[departmentKey] || departmentKey;
}

const PLAN_AREA_ALIASES: Record<string, string[]> = {
  produto: ['produto', 'produtos'],
  produtos: ['produto', 'produtos'],
  equipa: ['equipa', 'recursos-humanos'],
  'recursos-humanos': ['equipa', 'recursos-humanos'],
  financeiro: ['financeiro', 'contabilidade'],
  contabilidade: ['financeiro', 'contabilidade'],
  operacao: ['operacao', 'processos'],
  geral: ['geral', 'outro'],
};

export function planningAreaMatches(area: string | null | undefined, areaFilter: string) {
  if (!area) return false;
  const accepted = PLAN_AREA_ALIASES[areaFilter] || [areaFilter];
  return accepted.includes(area);
}

export function buildObjectiveAreaIndex(objectives: ObjectiveLike[]) {
  const index = new Map<string, string>();
  objectives.forEach((objective) => {
    if (objective.id && objective.area) index.set(objective.id, objective.area);
  });
  return index;
}

export function getPlanningGoalArea(goal: GoalLike, objectiveAreaById: Map<string, string>) {
  if (goal.area) return goal.area;
  return goal.objective_id ? objectiveAreaById.get(goal.objective_id) : undefined;
}

export function goalBelongsToDepartment(goal: GoalLike, objectiveAreaById: Map<string, string>, departmentKey: string) {
  const goalArea = getPlanningGoalArea(goal, objectiveAreaById);
  if (!goalArea) return false;

  const planArea = planningAreaForDepartment(departmentKey);
  return goalArea === planArea || goalArea === departmentKey;
}

export function goalBelongsToPlanArea(goal: GoalLike, objectiveAreaById: Map<string, string>, planAreaKey: string) {
  const goalArea = getPlanningGoalArea(goal, objectiveAreaById);
  return planningAreaMatches(goalArea, planAreaKey);
}