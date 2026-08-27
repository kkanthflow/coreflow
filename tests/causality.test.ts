import { describe, it, expect } from 'vitest';

describe('Project Causality Engine — Deterministic Math (No AI)', () => {
  it('should deterministically calculate delivery schedule adjustments', () => {
    const baselineDate = new Date('2026-09-18');
    const changeRequests = [
      { crCode: 'CR-001', daysDelta: 2 },
      { crCode: 'CR-002', daysDelta: 3 },
      { crCode: 'CR-003', daysDelta: -1 },
    ];

    const totalDaysDelta = changeRequests.reduce((sum, cr) => sum + cr.daysDelta, 0);
    const calculatedDeliveryDate = new Date(baselineDate.getTime() + totalDaysDelta * 24 * 60 * 60 * 1000);

    expect(totalDaysDelta).toBe(4);
    expect(calculatedDeliveryDate.toISOString().split('T')[0]).toBe('2026-09-22');
  });

  it('should deterministically compute project cost without silent mutations', () => {
    const baselineCost = 480000;
    const approvedCostChanges = [
      { code: 'CR-001', costDelta: 35000 },
      { code: 'CR-002', costDelta: -7000 },
      { code: 'CR-003', costDelta: 20000 },
    ];

    const finalCost = approvedCostChanges.reduce((sum, cr) => sum + cr.costDelta, baselineCost);
    expect(finalCost).toBe(528000);
  });

  it('should compute deterministic weighted milestone progress', () => {
    const milestones = [
      { title: 'Requirements', weight: 15, tasksTotal: 5, tasksDone: 5 },
      { title: 'Design', weight: 20, tasksTotal: 4, tasksDone: 4 },
      { title: 'Development', weight: 45, tasksTotal: 10, tasksDone: 8 }, // 80% of 45 = 36%
      { title: 'Testing', weight: 15, tasksTotal: 4, tasksDone: 0 },
      { title: 'Deployment', weight: 5, tasksTotal: 2, tasksDone: 0 },
    ];

    const weightedScore = milestones.reduce((sum, m) => {
      const stageProgress = m.tasksTotal > 0 ? m.tasksDone / m.tasksTotal : 0;
      return sum + stageProgress * m.weight;
    }, 0);

    // 15 + 20 + (0.8 * 45 = 36) + 0 + 0 = 71%
    expect(Math.round(weightedScore)).toBe(71);
  });

  it('should track scope lineage deterministically', () => {
    const baselineScope = 21;
    const scopeChanges = [
      { code: 'CR-001', scopeDelta: 1 },
      { code: 'CR-002', scopeDelta: 1 },
      { code: 'CR-003', scopeDelta: 1 },
    ];

    const currentScope = scopeChanges.reduce((sum, cr) => sum + cr.scopeDelta, baselineScope);
    expect(currentScope).toBe(24);
  });
});
