import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, Calendar, Award, GraduationCap, Clock,
  Plus, Search, Filter, CheckCircle2, AlertTriangle, RefreshCw,
  Shield, ArrowRight, Check, X, User, HeartHandshake
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../ui/Toast';
import { DepartmentHeader } from '../DepartmentHeader';
import { DepartmentTabs, type TabDefinition } from '../DepartmentTabs';
import type { DepartmentOperationalRecord } from '../modules/ModuleDetailView';

interface HRWorkspaceProps {
  department: any;
  deptId: string;
  orgId: string;
  members: any[];
  canAdminWorkspace: boolean;
  isOwner: boolean;
  hasOrgOversight: boolean;
  onRefresh: () => void;
}

export function HRWorkspace({
  department,
  deptId,
  orgId,
  members,
  canAdminWorkspace,
  isOwner,
  hasOrgOversight,
  onRefresh,
}: HRWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [candidates, setCandidates] = useState<DepartmentOperationalRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<DepartmentOperationalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Candidate Form
  const [candidateName, setCandidateName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [candidateExp, setCandidateExp] = useState('3+ Years');
  const [candidateStage, setCandidateStage] = useState('applied');

  // Leave Form
  const [leaveMemberId, setLeaveMemberId] = useState('');
  const [leaveType, setLeaveType] = useState('Paid Time Off (PTO)');
  const [leaveDays, setLeaveDays] = useState('3');
  const [leaveStartDate, setLeaveStartDate] = useState('');

  // Load HR Data
  const loadHRData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('department_records')
        .select(`
          *,
          assigned_user:users!assigned_to(id, full_name, email)
        `)
        .eq('department_id', deptId);

      if (error) {
        console.warn('Error loading HR department_records:', error);
      } else {
        const allRecords = data || [];
        setCandidates(allRecords.filter(r => r.module_key === 'recruitment'));
        setLeaveRequests(allRecords.filter(r => r.module_key === 'leave_approvals'));
      }
    } catch (err: any) {
      console.error('Error loading HR data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHRData();
  }, [deptId, orgId]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const pendingLeave = leaveRequests.filter(l => l.status === 'pending');
    const activeCandidates = candidates.filter(c => c.status !== 'hired' && c.status !== 'rejected');

    return {
      headcount: members.length,
      activeCandidatesCount: activeCandidates.length,
      pendingLeaveCount: pendingLeave.length,
      retentionRate: 98,
    };
  }, [members, candidates, leaveRequests]);

  // Create Candidate
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !targetRole.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'recruitment',
        title: candidateName.trim(),
        description: `Candidate for ${targetRole.trim()}`,
        status: candidateStage,
        priority: 'high',
        metadata: {
          role: targetRole.trim(),
          experience: candidateExp,
        },
      });

      if (error) throw error;
      toast.success('Candidate profile added.');
      setIsCandidateModalOpen(false);
      setCandidateName('');
      setTargetRole('');
      loadHRData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Leave Request
  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDays || !leaveStartDate) return;

    setSubmitting(true);
    try {
      const member = members.find(m => m.user_id === leaveMemberId) || members[0];
      const memberName = member?.user?.full_name || 'Staff Member';

      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'leave_approvals',
        title: `${memberName} — ${leaveType}`,
        description: `${leaveDays} days starting ${leaveStartDate}`,
        status: 'pending',
        priority: 'medium',
        assigned_to: leaveMemberId || null,
        due_date: leaveStartDate,
        metadata: {
          type: leaveType,
          days: parseInt(leaveDays, 10),
          start_date: leaveStartDate,
        },
      });

      if (error) throw error;
      toast.success('Leave request submitted.');
      setIsLeaveModalOpen(false);
      loadHRData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit leave.');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Candidate Stage
  const handleCandidateStage = async (id: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: newStage, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Candidate moved to ${newStage}.`);
      loadHRData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update stage.');
    }
  };

  // Update Leave Status
  const handleLeaveStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Leave request ${newStatus}.`);
      loadHRData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update leave.');
    }
  };

  // HR Navigation Tabs
  const hrTabs: TabDefinition[] = [
    { id: 'overview', label: 'People Command', icon: Users },
    { id: 'recruitment', label: 'Recruitment & ATS', count: candidates.length, icon: UserPlus },
    { id: 'employees', label: 'Employee Directory', count: members.length, icon: User },
    { id: 'leave', label: 'Leave Approvals', count: leaveRequests.filter(l => l.status === 'pending').length, icon: Calendar },
    { id: 'performance', label: 'Performance & OKRs', icon: Award },
    { id: 'training', label: 'Training Hub', icon: GraduationCap },
  ];

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <DepartmentHeader
        name={department.name}
        description={department.description || 'Talent acquisition, employee experience, performance evaluations, and HR governance.'}
        color={department.color || '#6366F1'}
        badge="HUMAN RESOURCES & TALENT"
        headUser={department.head_user}
        parentDepartmentName={department.parent_department?.name}
      />

      {/* ── HR KPI METRIC STRIP ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Department Headcount</div>
          <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
            {metrics.headcount}
          </div>
          <div className="text-[10px] text-text-muted mt-1">Assigned Personnel</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Active Requisitions</div>
          <div className="text-xl font-bold font-mono text-accent mt-1">
            {metrics.activeCandidatesCount}
          </div>
          <div className="text-[10px] text-text-muted mt-1">Candidates in Pipeline</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Pending Leave Requests</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {metrics.pendingLeaveCount}
          </div>
          <div className="text-[10px] text-text-muted mt-1">Awaiting Manager Sign-off</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Retention Rate</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {metrics.retentionRate}%
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-1">High Talent Stability</div>
        </div>
      </div>

      {/* ── HR TABS ── */}
      <DepartmentTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={hrTabs}
      />

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* ATS Pipeline Funnel */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-indigo-400" />
                      <span>Applicant Tracking Pipeline (ATS)</span>
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">Active interview journeys across open departmental requisitions.</p>
                  </div>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsCandidateModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Candidate</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Applied</span>
                    <div className="text-base font-bold font-mono text-text-primary">
                      {candidates.filter(c => c.status === 'applied').length}
                    </div>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Screening</span>
                    <div className="text-base font-bold font-mono text-blue-400">
                      {candidates.filter(c => c.status === 'screening').length}
                    </div>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Interviewing</span>
                    <div className="text-base font-bold font-mono text-amber-400">
                      {candidates.filter(c => c.status === 'interview').length}
                    </div>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Offered</span>
                    <div className="text-base font-bold font-mono text-emerald-400">
                      {candidates.filter(c => c.status === 'offered').length}
                    </div>
                  </div>
                </div>

                {/* Candidate List */}
                <div className="pt-3 border-t border-border-subtle space-y-2">
                  <div className="text-xs font-semibold text-text-primary">Active Candidates</div>
                  {candidates.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">No candidates in pipeline. Click 'Add Candidate' to intake applicant profiles.</p>
                  ) : (
                    <div className="space-y-2">
                      {candidates.slice(0, 4).map(c => (
                        <div key={c.id} className="p-3 bg-surface-2 border border-border-subtle rounded-lg flex justify-between items-center text-xs">
                          <div>
                            <div className="font-semibold text-text-primary">{c.title}</div>
                            <div className="text-[11px] text-text-muted">{c.metadata?.role || 'Applicant'} • {c.metadata?.experience || 'Experienced'}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-surface-1 border border-border-subtle text-text-muted">
                            {c.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Leave Approvals */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>Time-Off Approvals Queue ({metrics.pendingLeaveCount})</span>
                  </h3>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Request Leave</span>
                    </button>
                  )}
                </div>

                {leaveRequests.filter(l => l.status === 'pending').length === 0 ? (
                  <p className="text-xs text-text-muted">No pending leave requests requiring manager review.</p>
                ) : (
                  <div className="space-y-2">
                    {leaveRequests
                      .filter(l => l.status === 'pending')
                      .slice(0, 4)
                      .map(leave => (
                        <div
                          key={leave.id}
                          className="flex items-center justify-between p-3 bg-surface-2 border border-border-subtle rounded-lg text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-text-primary">{leave.title}</div>
                            <div className="text-[11px] text-text-muted">{leave.description}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canAdminWorkspace && (
                              <>
                                <button
                                  onClick={() => handleLeaveStatus(leave.id, 'approved')}
                                  className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 font-semibold"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleLeaveStatus(leave.id, 'rejected')}
                                  className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 font-semibold"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Policies & Team Structure */}
            <div className="space-y-6">
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  <span>HR Governance & Policies</span>
                </h3>
                <div className="text-xs text-text-muted space-y-2">
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>PTO Policy:</span>
                    <strong className="text-text-primary">24 Days / Year</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>Performance Cycle:</span>
                    <strong className="text-emerald-400">Quarterly OKRs</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>HR Business Partner:</span>
                    <strong className="text-text-primary">{department.head_user?.full_name || 'Unassigned'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: RECRUITMENT ── */}
      {activeTab === 'recruitment' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-text-primary">Applicant Tracking & Candidate Pipeline</h3>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsCandidateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Candidate</span>
              </button>
            )}
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Role Requisition</th>
                  <th className="py-3 px-4">Experience</th>
                  <th className="py-3 px-4">Pipeline Stage</th>
                  {canAdminWorkspace && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {candidates.map(c => (
                  <tr key={c.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{c.title}</td>
                    <td className="py-3 px-4 text-text-muted">{c.metadata?.role || 'General'}</td>
                    <td className="py-3 px-4 text-text-muted">{c.metadata?.experience || 'Experienced'}</td>
                    <td className="py-3 px-4">
                      <select
                        value={c.status}
                        onChange={e => handleCandidateStage(c.id, e.target.value)}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-2 border border-border-subtle text-text-primary"
                      >
                        <option value="applied">Applied</option>
                        <option value="screening">Screening</option>
                        <option value="interview">Interview</option>
                        <option value="offered">Offered</option>
                        <option value="hired">Hired</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    {canAdminWorkspace && (
                      <td className="py-3 px-4 text-right">
                        {c.status !== 'hired' && (
                          <button
                            onClick={() => handleCandidateStage(c.id, 'hired')}
                            className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 font-semibold"
                          >
                            Hire Candidate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: EMPLOYEES ── */}
      {activeTab === 'employees' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Department Personnel Directory</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {members.map(m => (
              <div key={m.id} className="bg-surface-1 border border-border-subtle rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                  {m.user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-primary truncate">{m.user?.full_name || m.user?.email}</div>
                  <div className="text-[11px] text-text-muted capitalize">{m.department_role || 'staff'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: LEAVE ── */}
      {activeTab === 'leave' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-text-primary">Time-Off Requests & Approvals</h3>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit Leave</span>
              </button>
            )}
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee / Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Status</th>
                  {canAdminWorkspace && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {leaveRequests.map(l => (
                  <tr key={l.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{l.title}</td>
                    <td className="py-3 px-4 text-text-muted">{l.metadata?.days || 1} Days</td>
                    <td className="py-3 px-4 text-text-muted">{l.due_date || 'Upcoming'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        l.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        l.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    {canAdminWorkspace && (
                      <td className="py-3 px-4 text-right">
                        {l.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleLeaveStatus(l.id, 'approved')}
                              className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded font-semibold"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleLeaveStatus(l.id, 'rejected')}
                              className="px-2 py-1 bg-red-500/10 text-red-400 rounded font-semibold"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: PERFORMANCE ── */}
      {activeTab === 'performance' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Quarterly Appraisal Cycles & Goal OKRs</h3>
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center text-xs text-text-muted">
            <Award className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
            <p className="font-semibold text-text-primary">OKR Performance Engine Active</p>
            <p className="mt-1">Department goals and employee quarterly appraisals are tracked here.</p>
          </div>
        </div>
      )}

      {/* ── TAB 6: TRAINING ── */}
      {activeTab === 'training' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Employee Upskilling & Certifications</h3>
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center text-xs text-text-muted">
            <GraduationCap className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
            <p className="font-semibold text-text-primary">Training Modules & Certifications</p>
            <p className="mt-1">Internal professional development workshops are scheduled and recorded here.</p>
          </div>
        </div>
      )}

      {/* ── MODALS: ADD CANDIDATE ── */}
      {isCandidateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">Add Candidate Profile</h3>
              <button onClick={() => setIsCandidateModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCandidate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  value={candidateName}
                  onChange={e => setCandidateName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Target Role</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Designer"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Experience</label>
                  <select
                    value={candidateExp}
                    onChange={e => setCandidateExp(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  >
                    <option value="1-2 Years">1-2 Years</option>
                    <option value="3-5 Years">3-5 Years</option>
                    <option value="5+ Years">5+ Years</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsCandidateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg"
                >
                  Save Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODALS: REQUEST LEAVE ── */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">Submit Time-Off Request</h3>
              <button onClick={() => setIsLeaveModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLeave} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Team Member</label>
                <select
                  value={leaveMemberId}
                  onChange={e => setLeaveMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.user_id}>
                      {m.user?.full_name || m.user?.email || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Days Requested</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={leaveDays}
                    onChange={e => setLeaveDays(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={e => setLeaveStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
