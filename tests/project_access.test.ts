import assert from 'node:assert';
import { resolveProjectScope, hasPermission } from '../web/src/lib/permissions';

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

describe('Project Access Control & Visibility Scope Resolution', () => {
  describe('RBAC WHAT Permissions', () => {
    it('grants owner full project creation, viewing, managing, and org-wide visibility', () => {
      expect(hasPermission('owner', 'view_projects')).toBe(true);
      expect(hasPermission('owner', 'view_all_projects')).toBe(true);
      expect(hasPermission('owner', 'manage_projects')).toBe(true);
      expect(hasPermission('owner', 'manage_all_projects')).toBe(true);
      expect(hasPermission('owner', 'create_projects')).toBe(true);
    });

    it('grants administrator org-wide project visibility and management', () => {
      expect(hasPermission('administrator', 'view_projects')).toBe(true);
      expect(hasPermission('administrator', 'view_all_projects')).toBe(true);
      expect(hasPermission('administrator', 'manage_projects')).toBe(true);
      expect(hasPermission('administrator', 'manage_all_projects')).toBe(true);
    });

    it('grants director department/project management without unconditional view_all_projects', () => {
      expect(hasPermission('director', 'view_projects')).toBe(true);
      expect(hasPermission('director', 'manage_projects')).toBe(true);
      expect(hasPermission('director', 'view_all_projects')).toBe(false);
    });

    it('restricts employee/intern to view_projects and basic task management', () => {
      expect(hasPermission('employee', 'view_projects')).toBe(true);
      expect(hasPermission('employee', 'create_projects')).toBe(false);
      expect(hasPermission('employee', 'manage_projects')).toBe(false);
      expect(hasPermission('employee', 'view_all_projects')).toBe(false);

      expect(hasPermission('intern', 'view_projects')).toBe(true);
      expect(hasPermission('intern', 'create_projects')).toBe(false);
      expect(hasPermission('intern', 'manage_projects')).toBe(false);
    });

    it('restricts freelancer inside organization', () => {
      expect(hasPermission({ role: 'freelancer', freelancerType: 'organization' }, 'view_projects')).toBe(true);
      expect(hasPermission({ role: 'freelancer', freelancerType: 'organization' }, 'create_projects')).toBe(false);
      expect(hasPermission({ role: 'freelancer', freelancerType: 'organization' }, 'manage_projects')).toBe(false);
    });

    it('allows independent freelancer to manage their own projects', () => {
      expect(hasPermission({ role: 'freelancer', freelancerType: 'independent' }, 'create_projects')).toBe(true);
      expect(hasPermission({ role: 'freelancer', freelancerType: 'independent' }, 'view_projects')).toBe(true);
      expect(hasPermission({ role: 'freelancer', freelancerType: 'independent' }, 'manage_projects')).toBe(true);
    });
  });

  describe('Project Access Scope WHERE Resolver', () => {
    it('resolves OWNER to "all" projects', () => {
      const scope = resolveProjectScope({
        userId: 'user-owner-1',
        role: 'owner',
        isOwner: true,
      });
      expect(scope).toBe('all');
    });

    it('resolves ADMINISTRATOR to "all" projects', () => {
      const scope = resolveProjectScope({
        userId: 'user-admin-1',
        role: 'administrator',
      });
      expect(scope).toBe('all');
    });

    it('resolves DIRECTOR with department to "department" scope', () => {
      const scope = resolveProjectScope({
        userId: 'user-director-dev',
        role: 'director',
        departmentId: 'dept-dev-1',
      });
      expect(scope).toBe('department');
    });

    it('resolves MANAGER with department to "department" scope', () => {
      const scope = resolveProjectScope({
        userId: 'user-mgr-mktg',
        role: 'manager',
        departmentId: 'dept-mktg-1',
      });
      expect(scope).toBe('department');
    });

    it('resolves EMPLOYEE to "assigned" scope only', () => {
      const scope = resolveProjectScope({
        userId: 'user-emp-1',
        role: 'employee',
        departmentId: 'dept-dev-1',
      });
      expect(scope).toBe('assigned');
    });

    it('resolves INTERN to "assigned" scope only', () => {
      const scope = resolveProjectScope({
        userId: 'user-intern-1',
        role: 'intern',
        departmentId: 'dept-dev-1',
      });
      expect(scope).toBe('assigned');
    });

    it('resolves ORG FREELANCER to "assigned" scope only', () => {
      const scope = resolveProjectScope({
        userId: 'user-freelancer-org',
        role: 'freelancer',
      });
      expect(scope).toBe('assigned');
    });
  });

  describe('Dynamic Multi-Department & Scale Authorization Scenario (Arbitrary N Projects)', () => {
    const deptDev = 'dept-development';
    const deptMktg = 'dept-marketing';
    const deptDesign = 'dept-design';
    const deptOps = 'dept-operations';

    interface MockProject {
      id: string;
      orgId: string | null;
      departmentId: string | null;
      ownerId: string | null;
    }

    interface MockProjectMember {
      projectId: string;
      userId: string;
      role: string;
      isActive: boolean;
    }

    interface MockClientAccess {
      projectId: string;
      userId: string;
      status: string;
      canView: boolean;
    }

    function createScenario(config: {
      devCount: number;
      mktgCount: number;
      designCount: number;
      opsCount: number;
    }) {
      const allProjects: MockProject[] = [];
      let currentId = 1;

      for (let i = 0; i < config.devCount; i++) {
        allProjects.push({ id: `prj-${currentId++}`, orgId: 'org-a', departmentId: deptDev, ownerId: 'user-owner' });
      }
      for (let i = 0; i < config.mktgCount; i++) {
        allProjects.push({ id: `prj-${currentId++}`, orgId: 'org-a', departmentId: deptMktg, ownerId: 'user-owner' });
      }
      for (let i = 0; i < config.designCount; i++) {
        allProjects.push({ id: `prj-${currentId++}`, orgId: 'org-a', departmentId: deptDesign, ownerId: 'user-owner' });
      }
      for (let i = 0; i < config.opsCount; i++) {
        allProjects.push({ id: `prj-${currentId++}`, orgId: 'org-a', departmentId: deptOps, ownerId: 'user-owner' });
      }

      return allProjects;
    }

    const allProjects = createScenario({
      devCount: 40,
      mktgCount: 25,
      designCount: 20,
      opsCount: 15,
    });
    const totalProjectCount = allProjects.length;

    const projectMembers: MockProjectMember[] = [
      { projectId: 'prj-3', userId: 'user-emp-a', role: 'member', isActive: true },
      { projectId: 'prj-8', userId: 'user-emp-a', role: 'member', isActive: true },
      { projectId: 'prj-14', userId: 'user-emp-a', role: 'member', isActive: true },
      { projectId: 'prj-22', userId: 'user-freelancer-a', role: 'member', isActive: true },
    ];

    const clientAccesses: MockClientAccess[] = [
      { projectId: 'prj-50', userId: 'user-client-a', status: 'active', canView: true },
    ];

    function canUserViewMockProject(userId: string, role: string, userDeptId: string | null, prj: MockProject): boolean {
      const clientAccess = clientAccesses.find(ca => ca.projectId === prj.id && ca.userId === userId && ca.status === 'active' && ca.canView);
      if (clientAccess) return true;

      if (!prj.orgId) {
        return prj.ownerId === userId;
      }

      if (role === 'owner' || role === 'administrator') return true;

      if (['director', 'senior_manager', 'manager'].includes(role) && userDeptId && prj.departmentId === userDeptId) {
        return true;
      }

      const isMember = projectMembers.some(pm => pm.projectId === prj.id && pm.userId === userId && pm.isActive);
      if (isMember) return true;

      return false;
    }

    it('Owner dynamically sees 100% of all organization projects regardless of scale (N projects)', () => {
      const visible = allProjects.filter(p => canUserViewMockProject('user-owner', 'owner', null, p));
      expect(visible.length).toBe(totalProjectCount);
    });

    it('Department Head dynamically sees only their department projects', () => {
      const expectedDevCount = allProjects.filter(p => p.departmentId === deptDev).length;
      const visible = allProjects.filter(p => canUserViewMockProject('user-dev-head', 'director', deptDev, p));
      expect(visible.length).toBe(expectedDevCount);
      expect(visible.every(p => p.departmentId === deptDev)).toBe(true);
    });

    it('Employee A assigned to Project 03, 08, 14 sees exactly their 3 assigned projects', () => {
      const visible = allProjects.filter(p => canUserViewMockProject('user-emp-a', 'employee', deptDev, p));
      expect(visible.length).toBe(3);
      expect(visible.map(p => p.id).sort()).toEqual(['prj-14', 'prj-3', 'prj-8']);
    });

    it('Freelancer A assigned to Project 22 sees exactly their 1 assigned project', () => {
      const visible = allProjects.filter(p => canUserViewMockProject('user-freelancer-a', 'freelancer', null, p));
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe('prj-22');
    });

    it('Client A with access to Project 50 sees exactly 1 project and is denied on others', () => {
      const visible = allProjects.filter(p => canUserViewMockProject('user-client-a', 'client', null, p));
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe('prj-50');

      expect(canUserViewMockProject('user-client-a', 'client', null, allProjects.find(p => p.id === 'prj-22')!)).toBe(false);
      expect(canUserViewMockProject('user-client-a', 'client', null, allProjects.find(p => p.id === 'prj-51')!)).toBe(false);
    });
  });
});
