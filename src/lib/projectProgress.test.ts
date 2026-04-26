import { describe, it, expect } from 'vitest';
import {
  isDeliverableDone,
  isPhaseDone,
  isProjectDone,
  percent,
  deliverableProgress,
  phaseProgress,
  projectProgress,
  progressLabel,
  isPhaseComplete,
  getDeliverableStatusInfo,
  getPhaseStatusInfo,
} from './projectProgress';

describe('status predicates', () => {
  it('treats all done aliases as done (deliverable)', () => {
    expect(isDeliverableDone({ status: 'concluido' })).toBe(true);
    expect(isDeliverableDone({ status: 'concluida' })).toBe(true);
    expect(isDeliverableDone({ status: 'entregue' })).toBe(true);
    expect(isDeliverableDone({ status: 'done' })).toBe(true);
    expect(isDeliverableDone({ status: 'pendente' })).toBe(false);
    expect(isDeliverableDone(null)).toBe(false);
  });

  it('phase done aliases', () => {
    expect(isPhaseDone({ status: 'concluida' })).toBe(true);
    expect(isPhaseDone({ status: 'concluido' })).toBe(true);
    expect(isPhaseDone({ status: 'em_curso' })).toBe(false);
  });

  it('project done aliases', () => {
    expect(isProjectDone({ status: 'concluido' })).toBe(true);
    expect(isProjectDone({ status: 'em_curso' })).toBe(false);
  });
});

describe('percent', () => {
  it('returns 0 for total=0', () => expect(percent(5, 0)).toBe(0));
  it('clamps to 100', () => expect(percent(10, 5)).toBe(100));
  it('rounds correctly', () => expect(percent(1, 3)).toBe(33));
});

describe('progress aggregations', () => {
  const deliverables = [
    { status: 'concluido' },
    { status: 'concluido' },
    { status: 'pendente' },
    { status: 'em_progresso' },
  ];

  it('deliverableProgress', () => {
    expect(deliverableProgress(deliverables)).toBe(50);
  });

  it('phaseProgress', () => {
    expect(phaseProgress([{ status: 'concluida' }, { status: 'pendente' }])).toBe(50);
  });

  it('projectProgress prefers deliverables', () => {
    expect(projectProgress(deliverables, [{ status: 'pendente' }])).toBe(50);
  });

  it('projectProgress falls back to phases', () => {
    expect(projectProgress([], [{ status: 'concluida' }])).toBe(100);
  });

  it('projectProgress returns 0 when both empty', () => {
    expect(projectProgress([], [])).toBe(0);
  });

  it('progressLabel uses deliverables when available', () => {
    expect(progressLabel(deliverables, [])).toBe('2/4 entregas');
  });

  it('progressLabel falls back to phases', () => {
    expect(progressLabel([], [{ status: 'concluida' }, { status: 'pendente' }]))
      .toBe('1/2 fases');
  });
});

describe('isPhaseComplete', () => {
  it('false when empty', () => expect(isPhaseComplete([])).toBe(false));
  it('true when all done', () => {
    expect(isPhaseComplete([{ status: 'concluido' }, { status: 'entregue' }])).toBe(true);
  });
  it('false when one pending', () => {
    expect(isPhaseComplete([{ status: 'concluido' }, { status: 'pendente' }])).toBe(false);
  });
});

describe('status info getters', () => {
  it('returns canonical info for known status', () => {
    expect(getDeliverableStatusInfo('concluido').label).toBe('Concluído');
    expect(getPhaseStatusInfo('em_curso').label).toBe('Em curso');
  });

  it('returns fallback for unknown status', () => {
    expect(getDeliverableStatusInfo('xpto').value).toBe('xpto');
    expect(getPhaseStatusInfo(null).value).toBe('pendente');
  });
});
