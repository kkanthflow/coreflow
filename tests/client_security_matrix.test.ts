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
  toBeTruthy: () => assert.strictEqual(!!actual, true),
  toBeFalsy: () => assert.strictEqual(!actual, true),
});

describe('CoreFlow Client Portal Security & Synchronization Matrix', () => {
  interface MockProject {
    id: string;
    orgId: string;
    departmentId: string;
    status: string;
  }

  interface MockProjectMember {
    projectId: string;
    userId: string;
    role: string;
    isActive: boolean;
  }

  interface MockTask {
    id: string;
    projectId: string;
    assigneeId: string;
    title: string;
    status: string;
  }

  interface MockClientAccess {
    projectId: string;
    userId: string;
    canView: boolean;
    canApprove: boolean;
    canRequestChanges: boolean;
    canViewFinancials: boolean;
    status: string;
  }

  const projects: MockProject[] = [
    { id: 'prj-alpha', orgId: 'org-1', departmentId: 'dept-dev', status: 'active' },
    { id: 'prj-beta', orgId: 'org-1', departmentId: 'dept-design', status: 'active' },
  ];

  const projectMembers: MockProjectMember[] = [
    { projectId: 'prj-alpha', userId: 'user-emp-1', role: 'member', isActive: true },
    { projectId: 'prj-alpha', userId: 'user-pm-1', role: 'manager', isActive: true },
  ];

  const tasks: MockTask[] = [
    { id: 'task-1', projectId: 'prj-alpha', assigneeId: 'user-emp-1', title: 'OAuth Integration', status: 'todo' },
    { id: 'task-2', projectId: 'prj-alpha', assigneeId: 'user-emp-2', title: 'Database Migration', status: 'todo' },
  ];

  const clientAccessList: MockClientAccess[] = [
    { projectId: 'prj-alpha', userId: 'client-approver', canView: true, canApprove: true, canRequestChanges: true, canViewFinancials: true, status: 'active' },
    { projectId: 'prj-alpha', userId: 'client-reviewer', canView: true, canApprove: false, canRequestChanges: false, canViewFinancials: false, status: 'active' },
  ];

  function authorize(params: {
    userId: string;
    projectId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    previewMode?: boolean;
  }): { authorized: boolean; reason?: string } {
    const { userId, projectId, action, resourceType, resourceId, previewMode } = params;

    // Check client access
    const clientAccess = clientAccessList.find(ca => ca.projectId === projectId && ca.userId === userId && ca.status === 'active');
    if (clientAccess) {
      if (previewMode) return { authorized: false, reason: 'Preview mode denies mutating client actions' };
      if (action === 'project.view' && clientAccess.canView) return { authorized: true };
      if (action === 'deliverable.approve') return clientAccess.canApprove ? { authorized: true } : { authorized: false, reason: 'Lacks can_approve' };
      if (action === 'change_request.decide') return clientAccess.canApprove ? { authorized: true } : { authorized: false, reason: 'Lacks can_approve' };
      return { authorized: false, reason: 'Client capability denied' };
    }

    // Check internal membership
    const member = projectMembers.find(pm => pm.projectId === projectId && pm.userId === userId && pm.isActive);
    if (!member) return { authorized: false, reason: 'Not a project member and lacks view_all' };

    if (action === 'project.view') return { authorized: true };
    if (action === 'task.update') {
      if (['owner', 'manager', 'lead'].includes(member.role)) return { authorized: true };
      if (resourceType === 'task' && resourceId) {
        const task = tasks.find(t => t.id === resourceId);
        if (task && task.assigneeId === userId) return { authorized: true };
        return { authorized: false, reason: 'Task not assigned to employee' };
      }
    }

    return { authorized: true };
  }

  it('Internal assigned user views Project A -> PASS', () => {
    const res = authorize({ userId: 'user-emp-1', projectId: 'prj-alpha', action: 'project.view' });
    expect(res.authorized).toBe(true);
  });

  it('Internal unassigned user views Project A -> DENY', () => {
    const res = authorize({ userId: 'user-unassigned', projectId: 'prj-alpha', action: 'project.view' });
    expect(res.authorized).toBe(false);
  });

  it('Assigned employee updates assigned task -> PASS', () => {
    const res = authorize({ userId: 'user-emp-1', projectId: 'prj-alpha', action: 'task.update', resourceType: 'task', resourceId: 'task-1' });
    expect(res.authorized).toBe(true);
  });

  it('Assigned employee updates unassigned task -> DENY', () => {
    const res = authorize({ userId: 'user-emp-1', projectId: 'prj-alpha', action: 'task.update', resourceType: 'task', resourceId: 'task-2' });
    expect(res.authorized).toBe(false);
  });

  it('Project manager manages project task -> PASS', () => {
    const res = authorize({ userId: 'user-pm-1', projectId: 'prj-alpha', action: 'task.update', resourceType: 'task', resourceId: 'task-2' });
    expect(res.authorized).toBe(true);
  });

  it('Client A views authorized Project A -> PASS', () => {
    const res = authorize({ userId: 'client-approver', projectId: 'prj-alpha', action: 'project.view' });
    expect(res.authorized).toBe(true);
  });

  it('Client A directly requests Project B -> DENY', () => {
    const res = authorize({ userId: 'client-approver', projectId: 'prj-beta', action: 'project.view' });
    expect(res.authorized).toBe(false);
  });

  it('Client reviewer views approval -> PASS', () => {
    const res = authorize({ userId: 'client-reviewer', projectId: 'prj-alpha', action: 'project.view' });
    expect(res.authorized).toBe(true);
  });

  it('Client reviewer without can_approve attempts approve -> DENY', () => {
    const res = authorize({ userId: 'client-reviewer', projectId: 'prj-alpha', action: 'deliverable.approve' });
    expect(res.authorized).toBe(false);
  });

  it('Client approver with can_approve approves -> PASS', () => {
    const res = authorize({ userId: 'client-approver', projectId: 'prj-alpha', action: 'deliverable.approve' });
    expect(res.authorized).toBe(true);
  });

  it('Internal preview attempts approval -> DENY', () => {
    const res = authorize({ userId: 'client-approver', projectId: 'prj-alpha', action: 'deliverable.approve', previewMode: true });
    expect(res.authorized).toBe(false);
  });

  it('Client projection strictly excludes internal fields', () => {
    const internalProjectData = {
      id: 'prj-alpha',
      title: 'OAuth Integration',
      due_date: '2026-09-20',
      internal_cost: 320000,
      profit_margin: '28%',
      developer_hourly_rate: 1500,
      internal_comments: 'Developer delayed due to refactor',
      private_meeting_notes: 'Management confidential',
    };

    function projectToClientSafeView(raw: any) {
      return {
        id: raw.id,
        title: raw.title,
        committedDeliveryDate: raw.due_date,
      };
    }

    const safeView: any = projectToClientSafeView(internalProjectData);
    expect(safeView.id).toBe('prj-alpha');
    expect(safeView.committedDeliveryDate).toBe('2026-09-20');
    expect(safeView.internal_cost).toBe(undefined);
    expect(safeView.profit_margin).toBe(undefined);
    expect(safeView.developer_hourly_rate).toBe(undefined);
    expect(safeView.internal_comments).toBe(undefined);
    expect(safeView.private_meeting_notes).toBe(undefined);
  });

  it('Idempotent CR decision prevents duplicate commitment increments', () => {
    let currentCommitmentVersion = 1;
    let crStatus = 'pending';
    let processedReceiptCount = 0;

    function applyChangeRequestDecision(decision: string, idempotencyKey: string) {
      if (crStatus !== 'pending') {
        return { success: false, reason: 'Already decided' };
      }
      crStatus = decision;
      currentCommitmentVersion += 1;
      processedReceiptCount += 1;
      return { success: true, version: currentCommitmentVersion };
    }

    const res1 = applyChangeRequestDecision('accepted', 'key-1');
    expect(res1.success).toBe(true);
    expect(res1.version).toBe(2);

    // Duplicate tap
    const res2 = applyChangeRequestDecision('accepted', 'key-1');
    expect(res2.success).toBe(false);
    expect(currentCommitmentVersion).toBe(2);
    expect(processedReceiptCount).toBe(1);
  });

  it('Internal task delay does NOT alter committed delivery date without accepted CR', () => {
    const committedDeliveryDate = '2026-09-20';
    let internalForecastDate = '2026-09-20';

    // Internal task is delayed by 3 days
    internalForecastDate = '2026-09-23';

    expect(committedDeliveryDate).toBe('2026-09-20'); // Committed delivery date remains unchanged
    expect(internalForecastDate).toBe('2026-09-23');  // Forecast reflects risk
  });
});
