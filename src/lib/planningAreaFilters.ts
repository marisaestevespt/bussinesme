type ObjectiveLike = { id?: string | null; area?: string | null };
type GoalLike = { objective_id?: string | null; area?: string | null };

const DEPARTMENT_TO_PLAN_AREA: Record<string, string> = {
  'recursos-humanos': 'equipa',
  equipa: 'equipa',
  produtos: 'produto',
  admin: 'outro',
};

export function planningAreaForDepartment(departmentKey: string): string {
  return DEPARTMENT_TO_PLAN_AREA[departmentKey] || departmentKey;
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
  return !!goalArea && goalArea === planAreaKey;
}