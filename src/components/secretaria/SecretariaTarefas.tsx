import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { TaskCustomViews } from './TaskCustomViews';

export default function SecretariaTarefas() {
  const unified = useUnifiedResponsibilities();
  return (
    <div className="space-y-4 mt-4">
      <TaskCustomViews
        scope="tasks"
        items={unified.items}
        defaultTitle="As minhas tarefas"
      />
    </div>
  );
}