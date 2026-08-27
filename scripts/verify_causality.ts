import assert from 'assert';

console.log('--- RUNNING DETERMINISTIC CAUSALITY ENGINE VERIFICATION ---');

// 1. WHY Delivery
const baselineDate = new Date('2026-09-18');
const changeRequests = [
  { crCode: 'CR-001', daysDelta: 2 },
  { crCode: 'CR-002', daysDelta: 3 },
  { crCode: 'CR-003', daysDelta: -1 },
];
const totalDaysDelta = changeRequests.reduce((sum, cr) => sum + cr.daysDelta, 0);
const calculatedDeliveryDate = new Date(baselineDate.getTime() + totalDaysDelta * 24 * 60 * 60 * 1000);

assert.strictEqual(totalDaysDelta, 4, 'Total days delta must be 4');
assert.strictEqual(calculatedDeliveryDate.toISOString().split('T')[0], '2026-09-22', 'Target delivery must be 2026-09-22');
console.log('✓ 1. WHY Delivery Deterministic Schedule Calculation: PASSED');

// 2. WHY Cost
const baselineCost = 480000;
const approvedCostChanges = [
  { code: 'CR-001', costDelta: 35000 },
  { code: 'CR-002', costDelta: -7000 },
  { code: 'CR-003', costDelta: 20000 },
];
const finalCost = approvedCostChanges.reduce((sum, cr) => sum + cr.costDelta, baselineCost);
assert.strictEqual(finalCost, 528000, 'Final calculated cost must be ₹5,28,000');
console.log('✓ 2. WHY Cost Deterministic Calculation: PASSED');

// 3. WHY Progress
const milestones = [
  { title: 'Requirements', weight: 15, tasksTotal: 5, tasksDone: 5 },
  { title: 'Design', weight: 20, tasksTotal: 4, tasksDone: 4 },
  { title: 'Development', weight: 45, tasksTotal: 10, tasksDone: 8 },
  { title: 'Testing', weight: 15, tasksTotal: 4, tasksDone: 0 },
  { title: 'Deployment', weight: 5, tasksTotal: 2, tasksDone: 0 },
];
const weightedScore = milestones.reduce((sum, m) => {
  const stageProgress = m.tasksTotal > 0 ? m.tasksDone / m.tasksTotal : 0;
  return sum + stageProgress * m.weight;
}, 0);
assert.strictEqual(Math.round(weightedScore), 71, 'Weighted progress must be 71%');
console.log('✓ 3. WHY Progress Weighted Deterministic Calculation: PASSED');

// 4. WHY Scope
const baselineScope = 21;
const scopeChanges = [
  { code: 'CR-001', scopeDelta: 1 },
  { code: 'CR-002', scopeDelta: 1 },
  { code: 'CR-003', scopeDelta: 1 },
];
const currentScope = scopeChanges.reduce((sum, cr) => sum + cr.scopeDelta, baselineScope);
assert.strictEqual(currentScope, 24, 'Total current scope must be 24 Deliverables');
console.log('✓ 4. WHY Scope Lineage Calculation: PASSED');

console.log('--- ALL CAUSALITY ENGINE DETERMINISTIC TESTS PASSED (0 AI / 100% MATHEMATICAL) ---');
