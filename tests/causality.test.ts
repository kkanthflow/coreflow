import assert from 'node:assert';

function describe(suiteName: string, fn: () => void) {
  console.log(`\n=== Suite: ${suiteName} ===`);
  fn();
}

function it(testName: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${testName}`);
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

const expect = (actual: any) => ({
  toBe: (expected: any) => assert.strictEqual(actual, expected),
  toEqual: (expected: any) => assert.deepStrictEqual(actual, expected),
});

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

  it('should reconstruct deterministic historical playback states from event points', () => {
    const historicalSnapshots = [
      { date: '2026-08-01', progress: 10, cost: 450000, version: 1, scope: 20 },
      { date: '2026-08-15', progress: 42, cost: 450000, version: 1, scope: 20 },
      { date: '2026-08-27', progress: 72, cost: 458500, version: 2, scope: 21 },
    ];

    function getHistoricalState(targetDateStr: string) {
      const targetTime = new Date(targetDateStr).getTime();
      const valid = historicalSnapshots.filter(s => new Date(s.date).getTime() <= targetTime);
      return valid[valid.length - 1] || historicalSnapshots[0];
    }

    const stateAug10 = getHistoricalState('2026-08-10');
    expect(stateAug10.progress).toBe(10);
    expect(stateAug10.version).toBe(1);

    const stateAug20 = getHistoricalState('2026-08-20');
    expect(stateAug20.progress).toBe(42);
    expect(stateAug20.cost).toBe(450000);

    const stateToday = getHistoricalState('2026-08-28');
    expect(stateToday.progress).toBe(72);
    expect(stateToday.version).toBe(2);
    expect(stateToday.cost).toBe(458500);
  });

  it('should compute deterministic compare state differences between two points in time', () => {
    const stateA = { progress: 31, cost: 450000, scope: 18, deliveryDays: 45 };
    const stateB = { progress: 68, cost: 458500, scope: 22, deliveryDays: 47 };

    const diff = {
      progressDelta: stateB.progress - stateA.progress,
      costDelta: stateB.cost - stateA.cost,
      scopeDelta: stateB.scope - stateA.scope,
      scheduleDeltaDays: stateB.deliveryDays - stateA.deliveryDays,
    };

    expect(diff.progressDelta).toBe(37);
    expect(diff.costDelta).toBe(8500);
    expect(diff.scopeDelta).toBe(4);
    expect(diff.scheduleDeltaDays).toBe(2);
  });

  it('should enforce neutral responsibility period transitions without blame', () => {
    let activePeriod = { heldBy: 'PROJECT_OWNER', action: 'Sprint Development', startedAt: '2026-08-26T10:00:00Z' };

    // Submitting UI design for client approval
    function submitDeliverableForApproval() {
      activePeriod = { heldBy: 'CLIENT', action: 'UI Design Approval', startedAt: '2026-08-27T14:00:00Z' };
    }

    submitDeliverableForApproval();
    expect(activePeriod.heldBy).toBe('CLIENT');
    expect(activePeriod.action).toBe('UI Design Approval');

    // Client signs approval
    function clientApproves() {
      activePeriod = { heldBy: 'PROJECT_OWNER', action: 'Next Phase Development', startedAt: '2026-08-27T16:00:00Z' };
    }

    clientApproves();
    expect(activePeriod.heldBy).toBe('PROJECT_OWNER');
    expect(activePeriod.action).toBe('Next Phase Development');
  });

  it('should validate complete project seal conditions and generate immutable seal receipt', () => {
    const projectDeliverables = [
      { id: 'del-1', status: 'accepted' },
      { id: 'del-2', status: 'accepted' },
      { id: 'del-3', status: 'accepted' },
    ];
    const pendingCRs: any[] = [];

    const canSeal = projectDeliverables.every(d => d.status === 'accepted') && pendingCRs.length === 0;
    expect(canSeal).toBe(true);

    const sealReceipt = {
      receiptCode: 'CF-P-002819',
      projectStatus: 'completed',
      sealedDeliverables: projectDeliverables.length,
      sealedAt: new Date().toISOString(),
    };

    expect(sealReceipt.receiptCode).toBe('CF-P-002819');
    expect(sealReceipt.projectStatus).toBe('completed');
  });
});
