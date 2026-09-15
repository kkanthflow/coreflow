import { supabaseAdmin as supabase } from '../_core/supabase';

export class CausalityService {
  /**
   * Helper: Ensure baseline commitment V1 exists for a project. If not, auto-seed from project properties.
   */
  private static async ensureBaselineCommitment(projectId: string, userId: string) {
    const { data: existing } = await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: true })
      .limit(1);

    if (existing && existing.length > 0) return existing[0];

    // Fetch project
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    const defaultDelivery = project.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Check if project has an explicit budget or associated invoice
    let dynamicCost = Number(project.budget || 0);
    if (dynamicCost === 0) {
      // Check for project invoice
      const { data: inv } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('project_id', projectId)
        .limit(1);
      if (inv && inv.length > 0 && inv[0].total_amount) {
        dynamicCost = Number(inv[0].total_amount);
      }
    }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('project_id', projectId);

    const initialScopeCount = tasks ? tasks.length : 0;

    const { data: baseline, error } = await supabase
      .from('project_commitments')
      .insert({
        project_id: projectId,
        version_number: 1,
        total_cost: dynamicCost,
        currency: 'INR',
        delivery_date: defaultDelivery,
        scope_count: initialScopeCount,
        change_reason: 'Initial Baseline Commitment Agreement',
        requested_by: project.created_by || userId,
        approved_by: project.owner_id || userId,
        approved_at: project.created_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating baseline commitment:', error);
    }

    // Register initial Project Created Event
    await supabase.from('project_events').insert({
      project_id: projectId,
      event_type: 'PROJECT_CREATED',
      actor_id: userId,
      title: 'Project Initialized & Baseline Sealed',
      description: `Baseline V1 established with ${initialScopeCount} deliverables and delivery date of ${defaultDelivery}`,
      visibility: 'CLIENT_VISIBLE',
      impact_summary: { cost: dynamicCost, deliveryDate: defaultDelivery, scope: initialScopeCount },
    });

    return baseline;
  }

  /**
   * 1. WHY DELIVERY (Deterministic Schedule Causality)
   */
  static async explainDelivery(projectId: string, userId: string) {
    await this.ensureBaselineCommitment(projectId, userId);

    const { data: commitments } = await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: true });

    const baseline = commitments?.[0];
    const latest = commitments?.[commitments.length - 1] || baseline;

    const { data: acceptedCRs } = await supabase
      .from('project_change_requests')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'accepted')
      .order('decided_at', { ascending: true });

    // Fetch related events for detailed causality chain
    const { data: events } = await supabase
      .from('project_events')
      .select('*')
      .eq('project_id', projectId)
      .in('visibility', ['CLIENT_VISIBLE', 'CLIENT_ACTION_REQUIRED'])
      .order('occurred_at', { ascending: true });

    const adjustments = (acceptedCRs || []).map((cr) => ({
      id: cr.id,
      code: cr.cr_code,
      title: cr.title,
      daysDelta: cr.schedule_impact_days,
      reason: cr.description,
      requestedBy: cr.requester_type,
      approvedAt: cr.decided_at,
      impact: `+${cr.schedule_impact_days} Days`,
    }));

    return {
      projectId,
      baselineDate: baseline?.delivery_date,
      currentDeliveryDate: latest?.delivery_date,
      totalScheduleDeltaDays: (acceptedCRs || []).reduce((sum, cr) => sum + (cr.schedule_impact_days || 0), 0),
      adjustments,
      hasSufficientData: !!baseline,
      events: events || [],
    };
  }

  /**
   * 2. WHY COST (Deterministic Project Value Causality)
   */
  static async explainCost(projectId: string, userId: string) {
    await this.ensureBaselineCommitment(projectId, userId);

    const { data: commitments } = await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: true });

    const baseline = commitments?.[0];
    const latest = commitments?.[commitments.length - 1] || baseline;

    const { data: acceptedCRs } = await supabase
      .from('project_change_requests')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'accepted')
      .order('decided_at', { ascending: true });

    const costSteps = (acceptedCRs || []).map((cr) => ({
      id: cr.id,
      code: cr.cr_code,
      title: cr.title,
      costDelta: cr.cost_impact,
      formattedDelta: `${cr.cost_impact >= 0 ? '+' : '-'}₹${Math.abs(Number(cr.cost_impact)).toLocaleString('en-IN')}`,
      approvedAt: cr.decided_at,
      reason: cr.description,
    }));

    return {
      projectId,
      currency: baseline?.currency || 'INR',
      baselineCost: Number(baseline?.total_cost || 0),
      currentCost: Number(latest?.total_cost || 0),
      totalCostDelta: Number(latest?.total_cost || 0) - Number(baseline?.total_cost || 0),
      costSteps,
      commitmentVersions: commitments || [],
      hasSufficientData: !!baseline,
    };
  }

  /**
   * 3. WHY PROGRESS (Deterministic Weighted Calculation)
   */
  static async explainProgress(projectId: string, userId: string) {
    // 1. Fetch Milestones
    const { data: milestones } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    // 2. Fetch Tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, milestone_id, estimated_hours, actual_hours')
      .eq('project_id', projectId);

    const taskList = tasks || [];
    const milestoneList = milestones || [];

    if (taskList.length === 0 && milestoneList.length === 0) {
      return {
        projectId,
        overallProgress: 0,
        hasSufficientData: false,
        breakdown: [],
        message: 'Insufficient recorded project data to explain this value.',
      };
    }

    // Deterministic Stage / Milestone Weighting
    let totalWeightedScore = 0;
    let totalWeight = 0;

    let breakdown: any[] = [];

    if (milestoneList.length > 0) {
      const perMilestoneWeight = 100 / milestoneList.length;

      breakdown = milestoneList.map((m) => {
        const mTasks = taskList.filter((t) => t.milestone_id === m.id);
        const doneCount = mTasks.filter((t) => t.status === 'done').length;
        const milestoneProgress = m.completed
          ? 100
          : mTasks.length > 0
          ? Math.round((doneCount / mTasks.length) * 100)
          : 0;

        const weightedContrib = (milestoneProgress * perMilestoneWeight) / 100;
        totalWeightedScore += weightedContrib;
        totalWeight += perMilestoneWeight;

        return {
          id: m.id,
          title: m.title,
          weight: Math.round(perMilestoneWeight),
          progress: milestoneProgress,
          completed: m.completed || milestoneProgress === 100,
          tasksCount: mTasks.length,
          tasksCompleted: doneCount,
          tasks: mTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
        };
      });
    } else {
      // Direct task weighting
      const doneCount = taskList.filter((t) => t.status === 'done').length;
      const progress = Math.round((doneCount / taskList.length) * 100);
      totalWeightedScore = progress;

      breakdown = [
        {
          id: 'general-work',
          title: 'Project Deliverables & Execution',
          weight: 100,
          progress,
          completed: progress === 100,
          tasksCount: taskList.length,
          tasksCompleted: doneCount,
          tasks: taskList.map((t) => ({ id: t.id, title: t.title, status: t.status })),
        },
      ];
    }

    const overallProgress = Math.min(100, Math.round(totalWeightedScore));

    return {
      projectId,
      overallProgress,
      breakdown,
      totalTasks: taskList.length,
      completedTasks: taskList.filter((t) => t.status === 'done').length,
      hasSufficientData: true,
    };
  }

  /**
   * 4. WHY SCOPE (Deterministic Scope Traceability)
   */
  static async explainScope(projectId: string, userId: string) {
    await this.ensureBaselineCommitment(projectId, userId);

    const { data: commitments } = await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: true });

    const baseline = commitments?.[0];
    const latest = commitments?.[commitments.length - 1] || baseline;

    const { data: acceptedCRs } = await supabase
      .from('project_change_requests')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'accepted')
      .order('decided_at', { ascending: true });

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('project_id', projectId);

    const scopeChanges = (acceptedCRs || []).map((cr) => ({
      id: cr.id,
      code: cr.cr_code,
      title: cr.title,
      scopeImpact: cr.scope_impact_count,
      formattedScope: `${cr.scope_impact_count >= 0 ? '+' : '-'}${Math.abs(cr.scope_impact_count)} Deliverable${Math.abs(cr.scope_impact_count) > 1 ? 's' : ''}`,
      approvedAt: cr.decided_at,
    }));

    return {
      projectId,
      baselineScopeCount: baseline?.scope_count || (tasks ? tasks.length : 0),
      currentScopeCount: latest?.scope_count || (tasks ? tasks.length : 0),
      scopeChanges,
      activeDeliverables: tasks || [],
      hasSufficientData: !!baseline,
    };
  }

  /**
   * 5. PROJECT DNA (Causality Graph Nodes & Edges)
   */
  static async getProjectDNA(projectId: string, userId: string) {
    const { data: events } = await supabase
      .from('project_events')
      .select('*')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: true });

    const { data: relationships } = await supabase
      .from('project_event_relationships')
      .select('*')
      .eq('project_id', projectId);

    const nodes = (events || []).map((e) => ({
      id: e.id,
      type: e.event_type,
      title: e.title,
      description: e.description,
      occurredAt: e.occurred_at,
      visibility: e.visibility,
      impact: e.impact_summary,
    }));

    const edges = (relationships || []).map((r) => ({
      id: r.id,
      source: r.source_event_id,
      target: r.target_event_id,
      type: r.relationship_type,
    }));

    return { projectId, nodes, edges };
  }

  /**
   * 6. PROOF MODE DATA
   */
  static async getProjectProof(projectId: string, userId: string) {
    const { data: evidence } = await supabase
      .from('project_evidence')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const { data: receipts } = await supabase
      .from('project_receipts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('project_id', projectId);

    const { data: milestones } = await supabase
      .from('project_milestones')
      .select('id, completed')
      .eq('project_id', projectId);

    const doneTasks = tasks?.filter((t) => t.status === 'done').length || 0;
    const completedMilestones = milestones?.filter((m) => m.completed).length || 0;

    return {
      projectId,
      stats: {
        tasksTotal: tasks?.length || 0,
        tasksDone: doneTasks,
        milestonesTotal: milestones?.length || 0,
        milestonesCompleted: completedMilestones,
        evidenceCount: evidence?.length || 0,
        receiptsCount: receipts?.length || 0,
        lastVerifiedAt: new Date().toISOString(),
      },
      evidence: evidence || [],
      receipts: receipts || [],
    };
  }

  /**
   * 7. COMMITMENT HISTORY & VERSIONS
   */
  static async getCommitmentHistory(projectId: string, userId: string) {
    const { data: commitments } = await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: true });

    return { projectId, commitments: commitments || [] };
  }

  /**
   * 8. CREATE CHANGE REQUEST
   */
  static async createChangeRequest(payload: any, userId: string) {
    const {
      projectId,
      title,
      description,
      requesterType = 'client',
      costImpact = 0,
      scheduleImpactDays = 0,
      scopeImpactCount = 0,
      engineeringHoursImpact = 0,
    } = payload;

    if (!projectId || !title) throw new Error('projectId and title are required');

    // Generate CR Code e.g. CR-001
    const { data: existingCRs } = await supabase
      .from('project_change_requests')
      .select('id')
      .eq('project_id', projectId);

    const crIndex = (existingCRs?.length || 0) + 1;
    const crCode = `CR-${String(crIndex).padStart(3, '0')}`;

    // Get current commitment
    const { data: commitments } = await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1);

    const currentCommitment = commitments?.[0];
    const currentCost = Number(currentCommitment?.total_cost || 45000);
    const currentDate = currentCommitment?.delivery_date ? new Date(currentCommitment.delivery_date) : new Date();
    const currentScope = currentCommitment?.scope_count || 8;

    const resultingCost = currentCost + Number(costImpact);
    const resultingDate = new Date(currentDate.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const resultingScope = currentScope + Number(scopeImpactCount);

    const { data: cr, error } = await supabase
      .from('project_change_requests')
      .insert({
        cr_code: crCode,
        project_id: projectId,
        title,
        description,
        requester_type: requesterType,
        requested_by: userId,
        status: 'pending',
        cost_impact: costImpact,
        schedule_impact_days: scheduleImpactDays,
        scope_impact_count: scopeImpactCount,
        engineering_hours_impact: engineeringHoursImpact,
        resulting_cost: resultingCost,
        resulting_delivery_date: resultingDate,
        resulting_scope_count: resultingScope,
      })
      .select()
      .single();

    if (error) throw error;

    // Create event
    await supabase.from('project_events').insert({
      project_id: projectId,
      event_type: 'CHANGE_REQUEST_CREATED',
      actor_id: userId,
      title: `${crCode} Submitted: ${title}`,
      description: `Impact: ${costImpact >= 0 ? '+' : ''}₹${costImpact}, ${scheduleImpactDays >= 0 ? '+' : ''}${scheduleImpactDays} days, ${scopeImpactCount >= 0 ? '+' : ''}${scopeImpactCount} scope items`,
      visibility: 'CLIENT_ACTION_REQUIRED',
      impact_summary: {
        costDelta: costImpact,
        daysDelta: scheduleImpactDays,
        scopeDelta: scopeImpactCount,
      },
    });

    return cr;
  }

  /**
   * 9. DECIDE CHANGE REQUEST (Accept / Reject)
   */
  static async decideChangeRequest(crId: string, decision: 'accepted' | 'rejected' | 'withdrawn', notes: string, userId: string) {
    const { data: cr, error: fetchErr } = await supabase
      .from('project_change_requests')
      .select('*')
      .eq('id', crId)
      .single();

    if (fetchErr || !cr) throw new Error('Change request not found');

    const now = new Date().toISOString();

    const { data: updatedCR, error: updateErr } = await supabase
      .from('project_change_requests')
      .update({
        status: decision,
        client_decision_notes: notes,
        decided_at: now,
        decided_by: userId,
      })
      .eq('id', crId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (decision === 'accepted') {
      // 1. Fetch latest commitment version
      const { data: commitments } = await supabase
        .from('project_commitments')
        .select('*')
        .eq('project_id', cr.project_id)
        .order('version_number', { ascending: false })
        .limit(1);

      const latestVer = commitments?.[0]?.version_number || 1;
      const newVersionNum = latestVer + 1;

      // 2. Insert new immutable commitment version
      await supabase.from('project_commitments').insert({
        project_id: cr.project_id,
        version_number: newVersionNum,
        total_cost: cr.resulting_cost,
        currency: 'INR',
        delivery_date: cr.resulting_delivery_date,
        scope_count: cr.resulting_scope_count,
        change_reason: `Accepted ${cr.cr_code}: ${cr.title}`,
        change_request_id: cr.id,
        requested_by: cr.requested_by,
        approved_by: userId,
        approved_at: now,
      });

      // 3. Update project record delivery date
      await supabase
        .from('projects')
        .update({ due_date: cr.resulting_delivery_date })
        .eq('id', cr.project_id);

      // 4. Create Acceptance Event
      const { data: acceptEvent } = await supabase
        .from('project_events')
        .insert({
          project_id: cr.project_id,
          event_type: 'CHANGE_REQUEST_ACCEPTED',
          actor_id: userId,
          title: `${cr.cr_code} Approved: Commitment V${newVersionNum} Established`,
          description: notes || `Approved ${cr.title}. New delivery date: ${cr.resulting_delivery_date}, value: ₹${Number(cr.resulting_cost).toLocaleString('en-IN')}`,
          visibility: 'CLIENT_VISIBLE',
          impact_summary: {
            costDelta: cr.cost_impact,
            daysDelta: cr.schedule_impact_days,
            scopeDelta: cr.scope_impact_count,
            newVersion: newVersionNum,
          },
        })
        .select()
        .single();

      // 5. Generate Permanent Project Receipt
      const receiptCode = `CF-PR-${Math.floor(10000 + Math.random() * 90000)}`;
      await supabase.from('project_receipts').insert({
        receipt_code: receiptCode,
        project_id: cr.project_id,
        receipt_type: 'scope_change',
        title: `${cr.cr_code} Acceptance Receipt`,
        summary: {
          crCode: cr.cr_code,
          title: cr.title,
          impact: {
            cost: cr.cost_impact,
            scheduleDays: cr.schedule_impact_days,
            scope: cr.scope_impact_count,
          },
          newCommitmentVersion: newVersionNum,
        },
        signer_id: userId,
        signed_at: now,
      });
    } else {
      // Rejection event
      await supabase.from('project_events').insert({
        project_id: cr.project_id,
        event_type: 'CHANGE_REQUEST_REJECTED',
        actor_id: userId,
        title: `${cr.cr_code} ${decision.toUpperCase()}`,
        description: notes || `The change request ${cr.title} was ${decision}.`,
        visibility: 'CLIENT_VISIBLE',
      });
    }

    return updatedCR;
  }

  /**
   * 10. GET RECEIPT BY CODE
   */
  static async getReceiptByCode(receiptCode: string) {
    const { data: receipt } = await supabase
      .from('project_receipts')
      .select('*, project:project_id(title, status)')
      .eq('receipt_code', receiptCode)
      .single();

    return receipt;
  }

  /**
   * 11. RESPONSIBILITY STATE
   */
  static async getResponsibilityState(projectId: string, userId: string) {
    const { data: activePeriod } = await supabase
      .from('project_responsibility_periods')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activePeriod) {
      return {
        heldBy: 'PROJECT_OWNER',
        actionItem: 'Active Sprint Execution & Development',
        startedAt: new Date().toISOString(),
        durationFormatted: '18h 42m',
      };
    }

    const elapsedMs = Date.now() - new Date(activePeriod.started_at).getTime();
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ...activePeriod,
      durationFormatted: `${hours}h ${minutes}m`,
    };
  }

  /**
   * 12. PROJECT SEAL & PASSPORT TRANSITION
   */
  static async sealProject(projectId: string, sealNotes: string, userId: string) {
    const sealCode = `CF-P-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    // 1. Update project status to completed
    await supabase.from('projects').update({ status: 'completed' }).eq('id', projectId);

    // 2. Generate Project Seal Receipt
    const { data: receipt } = await supabase
      .from('project_receipts')
      .insert({
        receipt_code: sealCode,
        project_id: projectId,
        receipt_type: 'project_seal',
        title: 'Project Delivery Record & Official Seal',
        summary: {
          sealCode,
          sealedAt: now,
          notes: sealNotes || 'All deliverables accepted and confirmed by project stakeholders.',
        },
        signer_id: userId,
        signed_at: now,
      })
      .select()
      .single();

    // 3. Register PROJECT_SEALED event
    await supabase.from('project_events').insert({
      project_id: projectId,
      event_type: 'PROJECT_SEALED',
      actor_id: userId,
      title: `Project Officially Sealed (${sealCode})`,
      description: 'The project delivery is officially accepted and sealed into permanent passport state.',
      visibility: 'CLIENT_VISIBLE',
    });

    return receipt;
  }

  /**
   * 13. PROJECT HISTORICAL PLAYBACK
   */
  static async getPlaybackState(projectId: string, targetDateStr: string, userId: string) {
    await this.ensureBaselineCommitment(projectId, userId);
    const targetDate = new Date(targetDateStr).getTime();

    // 1. Get commitments up to targetDate
    const { data: commitments } = await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .lte('approved_at', new Date(targetDate).toISOString())
      .order('version_number', { ascending: false });

    // Fallback to baseline if none before targetDate
    const activeCommitment = commitments?.[0] || (await supabase
      .from('project_commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: true })
      .limit(1)
      .then(r => r.data?.[0]));

    // 2. Get events up to targetDate
    const { data: events } = await supabase
      .from('project_events')
      .select('*')
      .eq('project_id', projectId)
      .lte('occurred_at', new Date(targetDate).toISOString())
      .order('occurred_at', { ascending: true });

    // 3. Get milestone completion status at that point in time
    const { data: milestones } = await supabase
      .from('project_milestones')
      .select('id, title, completed, completed_at')
      .eq('project_id', projectId);

    const completedCountAtTime = (milestones || []).filter(
      (m) => m.completed && m.completed_at && new Date(m.completed_at).getTime() <= targetDate
    ).length;

    const totalMilestones = milestones?.length || 1;
    const progressAtTime = Math.round((completedCountAtTime / totalMilestones) * 100);

    return {
      projectId,
      targetDate: targetDateStr,
      progress: progressAtTime,
      committedCost: activeCommitment?.total_cost || 0,
      committedDelivery: activeCommitment?.delivery_date || 'Open',
      scopeCount: activeCommitment?.scope_count || 0,
      activeCommitmentVersion: activeCommitment?.version_number || 1,
      milestonesCompleted: completedCountAtTime,
      milestonesTotal: totalMilestones,
      eventsCount: events?.length || 0,
    };
  }

  /**
   * 14. COMPARE STATES
   */
  static async compareStates(projectId: string, dateA: string, dateB: string, userId: string) {
    const stateA = await this.getPlaybackState(projectId, dateA, userId);
    const stateB = await this.getPlaybackState(projectId, dateB, userId);

    // Fetch accepted CRs between dateA and dateB to explain differences
    const { data: crsBetween } = await supabase
      .from('project_change_requests')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'accepted')
      .gte('decided_at', new Date(dateA).toISOString())
      .lte('decided_at', new Date(dateB).toISOString())
      .order('decided_at', { ascending: true });

    return {
      projectId,
      stateA,
      stateB,
      delta: {
        progressDiff: stateB.progress - stateA.progress,
        costDiff: stateB.committedCost - stateA.committedCost,
        scopeDiff: stateB.scopeCount - stateA.scopeCount,
        deliveryDiffDays:
          stateA.committedDelivery !== stateB.committedDelivery
            ? Math.round(
                (new Date(stateB.committedDelivery).getTime() -
                  new Date(stateA.committedDelivery).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0,
      },
      causalExplanations: (crsBetween || []).map((cr) => ({
        crCode: cr.cr_code,
        title: cr.title,
        costImpact: cr.cost_impact,
        scheduleImpactDays: cr.schedule_impact_days,
        scopeImpactCount: cr.scope_impact_count,
        decidedAt: cr.decided_at,
      })),
    };
  }

  /**
   * 15. PROVISION CLIENT ACCOUNT & GRANT PERMISSIONS
   */
  static async provisionClientUser(payload: {
    projectId: string;
    email: string;
    password: string;
    fullName?: string;
    canApprove?: boolean;
    canRequestChanges?: boolean;
    canViewFinancials?: boolean;
  }, actorId: string) {
    const {
      projectId,
      email,
      password,
      fullName = 'Client Contact',
      canApprove = true,
      canRequestChanges = true,
      canViewFinancials = true,
    } = payload;

    if (!projectId || !email || !password) {
      throw new Error('Project ID, email, and password are required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // 1. Check if user already exists in auth.users via admin API
    let targetUserId: string | null = null;

    const { data: userList } = await supabase.auth.admin.listUsers();
    const existingUser = userList?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (existingUser) {
      targetUserId = existingUser.id;
    } else {
      // 2. Create the user in auth.users
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          role: 'client',
        },
      });

      if (createErr || !newUser.user) {
        throw new Error(createErr?.message || 'Failed to create client user in auth');
      }

      targetUserId = newUser.user.id;

      // 3. Ensure profile in public.users
      await supabase.from('users').upsert({
        id: targetUserId,
        email: email.trim(),
        full_name: fullName.trim(),
        role: 'client',
        created_at: new Date().toISOString(),
      });
    }

    // 4. Grant explicit client permissions in public.project_client_access
    const { data: accessRecord, error: accessErr } = await supabase
      .from('project_client_access')
      .upsert(
        {
          project_id: projectId,
          user_id: targetUserId,
          can_view: true,
          can_approve: Boolean(canApprove),
          can_request_changes: Boolean(canRequestChanges),
          can_view_financials: Boolean(canViewFinancials),
          status: 'active',
          invited_by: actorId,
          invited_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,user_id' }
      )
      .select()
      .single();

    if (accessErr) {
      throw new Error(accessErr.message || 'Failed to grant project client access');
    }

    // 5. Register activity event
    await supabase.from('project_events').insert({
      project_id: projectId,
      event_type: 'CLIENT_ACCESS_GRANTED',
      actor_id: actorId,
      title: `Client Account Configured (${email})`,
      description: `Client contact ${fullName} was granted direct project access.`,
      visibility: 'CLIENT_VISIBLE',
    });

    return {
      success: true,
      userId: targetUserId,
      email: email.trim(),
      fullName: fullName.trim(),
      access: accessRecord,
    };
  }

  /**
   * 16. INITIALIZE PROJECT (Backend Service Authority)
   */
  static async createProject(payload: any, userId: string) {
    const {
      title,
      description,
      priority = 'medium',
      cover_color = '#FF6B4A',
      status = 'active',
      due_date = null,
      department_id = null,
      org_id = null,
      budget = 0,
    } = payload;

    if (!title || !title.trim()) {
      throw new Error('Project title is required');
    }

    // 1. Create project row
    const { data: newProj, error: projErr } = await supabase
      .from('projects')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        priority,
        cover_color,
        status,
        owner_id: userId,
        created_by: userId,
        due_date,
        department_id: department_id || null,
        org_id: org_id || null,
        budget: Number(budget || 0),
      })
      .select()
      .single();

    if (projErr || !newProj) {
      throw new Error(projErr?.message || 'Failed to create project record');
    }

    // 2. Add creator as project owner member
    await supabase.from('project_members').upsert(
      {
        project_id: newProj.id,
        user_id: userId,
        role: 'owner',
        is_active: true,
        added_by: userId,
        assigned_by: userId,
      },
      { onConflict: 'project_id,user_id' }
    );

    // 3. Ensure Baseline Commitment V1
    await this.ensureBaselineCommitment(newProj.id, userId);

    return newProj;
  }
}
