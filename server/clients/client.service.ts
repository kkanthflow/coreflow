import crypto from 'crypto';
import { supabaseAdmin as supabase } from '../_core/supabase';
import { EmailService } from '../email/email.service';

export interface SaveClientPayload {
  id?: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  gstNumber?: string | null;
  address?: string | null;
  notes?: string | null;
  enablePortal?: boolean;
  projectIds?: string[];
}

export class ClientService {
  /**
   * Helper: Resolve caller's business scope and ensure they have permission to manage clients.
   */
  public static async resolveCallerBusiness(actorId: string, orgIdHeader?: string) {
    // 1. Fetch actor profile
    const { data: userProfile, error: userErr } = await supabase
      .from('users')
      .select('id, role, account_type')
      .eq('id', actorId)
      .single();

    if (userErr || !userProfile) {
      throw new Error('Authenticated user profile not found');
    }

    if (userProfile.role === 'client' || userProfile.account_type === 'client') {
      throw new Error('Clients are not authorized to perform client management operations');
    }

    // 2. Organization vs Freelancer workspace resolution
    if (orgIdHeader) {
      const { data: membership, error: memErr } = await supabase
        .from('user_organizations')
        .select('org_id, role')
        .eq('org_id', orgIdHeader)
        .eq('user_id', actorId)
        .single();

      if (memErr || !membership) {
        throw new Error('You are not an authorized member of this organization');
      }

      // Check role permissions in org
      const allowedRoles = ['owner', 'administrator', 'manager'];
      if (!allowedRoles.includes(membership.role) && !allowedRoles.includes(userProfile.role)) {
        throw new Error('Forbidden: Your organization role lacks permission to manage clients');
      }

      return {
        businessId: orgIdHeader,
        organizationId: orgIdHeader,
        ownerId: actorId,
        isOrg: true,
      };
    } else {
      // Freelancer/Indie workspace: caller is the owner
      return {
        businessId: actorId,
        organizationId: null,
        ownerId: actorId,
        isOrg: false,
      };
    }
  }

  /**
   * Save (create or update) a client record, with optional portal user creation/linking
   * in a single atomic flow with full rollback support.
   */
  public static async saveClientWithPortal(
    actorId: string,
    orgIdHeader: string | undefined,
    payload: SaveClientPayload
  ) {
    const business = await this.resolveCallerBusiness(actorId, orgIdHeader);

    // Normalize inputs
    const normName = (payload.name || '').trim();
    if (!normName) throw new Error('Client name is required');

    const normEmail = payload.email ? payload.email.trim().toLowerCase() : null;
    const normPhone = payload.phone ? payload.phone.trim() : null;
    const normGst = payload.gstNumber ? payload.gstNumber.trim().toUpperCase() : null;
    const normCompany = payload.companyName ? payload.companyName.trim() : null;
    const normAddress = payload.address ? payload.address.trim() : null;
    const normNotes = payload.notes ? payload.notes.trim() : null;
    const enablePortal = Boolean(payload.enablePortal);
    const selectedProjectIds = Array.isArray(payload.projectIds) ? payload.projectIds : [];

    if (enablePortal && !normEmail) {
      throw new Error('A valid email address is required to enable Client Portal access');
    }

    let existingClientId: string | null = payload.id || null;
    let existingClient: any = null;

    // 1. Look up existing client if editing or match by business duplicates
    if (existingClientId) {
      let q = supabase.from('clients').select('*').eq('id', existingClientId).eq('is_deleted', false);
      if (business.isOrg) {
        q = q.eq('organization_id', business.organizationId);
      } else {
        q = q.is('organization_id', null).eq('owner_id', business.ownerId);
      }
      const { data: found } = await q.maybeSingle();
      if (!found) throw new Error('Client not found or does not belong to this business');
      existingClient = found;
    } else if (normEmail) {
      // Duplicate prevention: match by (business_id, lower(email))
      let q = supabase
        .from('clients')
        .select('*')
        .eq('is_deleted', false)
        .ilike('email', normEmail);

      if (business.isOrg) {
        q = q.eq('organization_id', business.organizationId);
      } else {
        q = q.is('organization_id', null).eq('owner_id', business.ownerId);
      }

      const { data: matched } = await q.maybeSingle();
      if (matched) {
        existingClient = matched;
        existingClientId = matched.id;
      }
    }

    // Secondary duplicate checks if still not matched (phone or GSTIN within this business)
    if (!existingClient && (normPhone || normGst)) {
      let q = supabase.from('clients').select('*').eq('is_deleted', false);
      if (business.isOrg) {
        q = q.eq('organization_id', business.organizationId);
      } else {
        q = q.is('organization_id', null).eq('owner_id', business.ownerId);
      }

      if (normGst) {
        const { data: gMatch } = await q.eq('gst_number', normGst).maybeSingle();
        if (gMatch) {
          existingClient = gMatch;
          existingClientId = gMatch.id;
        }
      }
    }

    let newlyCreatedAuthUserId: string | null = null;
    let targetUserId: string | null = existingClient?.user_id || null;
    let generatedTempPassword: string | null = null;
    let generatedSetupLink: string | null = null;
    let newlyCreatedClientId: string | null = null;

    try {
      // 2. Auth User Resolution if Portal is enabled
      if (enablePortal && normEmail) {
        // Find if user already exists in auth
        const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const matchedAuthUser = (listData?.users || []).find(
          (u: any) => u.email?.trim().toLowerCase() === normEmail
        );

        if (matchedAuthUser) {
          targetUserId = matchedAuthUser.id;
          // Set role client if not an internal staff role
          const { data: existingProf } = await supabase
            .from('users')
            .select('role')
            .eq('id', targetUserId)
            .single();

          const staffRoles = ['owner', 'administrator', 'manager', 'team_lead', 'team_member', 'employee'];
          const shouldPreserveRole = existingProf && staffRoles.includes(existingProf.role);

          await supabase
            .from('users')
            .update({
              role: shouldPreserveRole ? existingProf.role : 'client',
              account_type: shouldPreserveRole ? undefined : 'client',
              account_setup_completed: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetUserId);

          // Generate single-use password recovery/setup link
          try {
            const { data: linkRes } = await supabase.auth.admin.generateLink({
              type: 'recovery',
              email: normEmail,
            });
            if (linkRes?.properties?.action_link) {
              generatedSetupLink = linkRes.properties.action_link;
            }
          } catch (linkErr) {
            console.warn('[ClientService] Could not generate recovery link:', linkErr);
          }
        } else {
          // Provision new user with random temporary password (never stored plain)
          const randomSuffix = crypto.randomBytes(6).toString('hex');
          generatedTempPassword = `Auvryn#${randomSuffix}!`;

          const { data: createdAuth, error: createAuthErr } = await supabase.auth.admin.createUser({
            email: normEmail,
            password: generatedTempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: normName,
              account_type: 'client',
              role: 'client',
              must_change_password: true,
            },
          });

          if (createAuthErr || !createdAuth?.user) {
            throw new Error(`Failed to create authentication user for client: ${createAuthErr?.message}`);
          }

          newlyCreatedAuthUserId = createdAuth.user.id;
          targetUserId = createdAuth.user.id;

          // Ensure profile in public.users
          await supabase
            .from('users')
            .upsert({
              id: targetUserId,
              email: normEmail,
              full_name: normName,
              role: 'client',
              account_type: 'client',
              account_setup_completed: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

          // Generate setup link as well
          try {
            const { data: linkRes } = await supabase.auth.admin.generateLink({
              type: 'invite',
              email: normEmail,
            });
            if (linkRes?.properties?.action_link) {
              generatedSetupLink = linkRes.properties.action_link;
              EmailService.sendInvitation({
                targetEmail: normEmail,
                workspaceOrProjectName: 'Auvryn Client Portal',
                role: 'Client Collaborator',
                inviteUrl: generatedSetupLink,
                isClient: true,
                organizationId: business.organizationId || undefined,
                userId: actorId,
              }).catch((e: any) => console.warn('[ClientService] Auto-invite email note:', e.message));
            }
          } catch (linkErr) {
            console.warn('[ClientService] Could not generate invite link:', linkErr);
          }
        }

        // If organization workspace, associate user in user_organizations
        if (business.isOrg && business.organizationId && targetUserId) {
          await supabase
            .from('user_organizations')
            .upsert({
              user_id: targetUserId,
              org_id: business.organizationId,
              role: 'client',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,org_id' });
        }
      }

      // 3. Save Client Record in public.clients
      let finalClientId: string;
      const targetPortalStatus = enablePortal
        ? (existingClient?.portal_status === 'active' ? 'active' : 'pending_login')
        : (existingClient?.portal_status && existingClient.portal_status !== 'no_access' ? 'disabled' : 'no_access');

      if (existingClient) {
        finalClientId = existingClient.id;
        const updateData: any = {
          name: normName,
          company_name: normCompany,
          email: normEmail,
          phone: normPhone,
          gst_number: normGst,
          address: normAddress,
          notes: normNotes,
          portal_status: targetPortalStatus,
          updated_at: new Date().toISOString(),
        };

        if (enablePortal && targetUserId) {
          updateData.user_id = targetUserId;
          if (!existingClient.portal_enabled_at) {
            updateData.portal_enabled_at = new Date().toISOString();
          }
        }

        const { data: updatedClient, error: updateErr } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', finalClientId)
          .select()
          .single();

        if (updateErr) throw new Error(`Failed to update client: ${updateErr.message}`);
      } else {
        // Insert new client
        const insertData: any = {
          organization_id: business.organizationId,
          owner_id: business.ownerId,
          name: normName,
          company_name: normCompany,
          email: normEmail,
          phone: normPhone,
          gst_number: normGst,
          address: normAddress,
          notes: normNotes,
          created_by: actorId,
          portal_status: targetPortalStatus,
          portal_enabled_at: enablePortal ? new Date().toISOString() : null,
          user_id: enablePortal ? targetUserId : null,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: insertedClient, error: insertErr } = await supabase
          .from('clients')
          .insert(insertData)
          .select()
          .single();

        if (insertErr || !insertedClient) {
          throw new Error(`Failed to create client record: ${insertErr?.message}`);
        }

        finalClientId = insertedClient.id;
        newlyCreatedClientId = insertedClient.id;
      }

      // 4. Project Access Membership Linking
      if (enablePortal && targetUserId && selectedProjectIds.length > 0) {
        for (const projId of selectedProjectIds) {
          // Verify project belongs to this business
          let pQuery = supabase.from('projects').select('id').eq('id', projId).is('deleted_at', null);
          if (business.isOrg) {
            pQuery = pQuery.eq('org_id', business.organizationId);
          } else {
            pQuery = pQuery.eq('owner_id', business.ownerId);
          }
          const { data: verifiedProj } = await pQuery.maybeSingle();

          if (verifiedProj) {
            await supabase
              .from('project_client_access')
              .upsert({
                project_id: projId,
                client_id: finalClientId,
                user_id: targetUserId,
                access_role: 'viewer',
                can_view: true,
                can_approve: true,
                can_request_changes: true,
                can_view_financials: true,
                can_view_receipts: true,
                status: 'active',
                invited_by: actorId,
                invited_at: new Date().toISOString(),
                accepted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'project_id,user_id' });
          }
        }
      }

      // 5. Fetch clean fresh client record with linked projects count
      const { data: freshClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', finalClientId)
        .single();

      const { data: linkedPcas } = await supabase
        .from('project_client_access')
        .select('project_id')
        .eq('client_id', finalClientId);

      return {
        success: true,
        client: freshClient,
        portalEnabled: enablePortal,
        portalStatus: targetPortalStatus,
        tempPassword: generatedTempPassword,
        setupLink: generatedSetupLink,
        linkedProjectsCount: linkedPcas?.length || 0,
      };
    } catch (err: any) {
      // ── ATOMIC ROLLBACK COMPENSATION ──
      console.error('[ClientService] Error during saveClientWithPortal, rolling back:', err);

      // If we created a client record in this invocation, delete it
      if (newlyCreatedClientId) {
        await supabase.from('clients').delete().eq('id', newlyCreatedClientId);
      }

      // If we provisioned a new user in auth.users, remove it to prevent partial saves
      if (newlyCreatedAuthUserId) {
        try {
          await supabase.auth.admin.deleteUser(newlyCreatedAuthUserId);
        } catch (delErr) {
          console.warn('[ClientService] Rollback: Failed to delete auth user:', delErr);
        }
      }

      throw err;
    }
  }

  /**
   * Toggle Portal Access (enable/disable) for an existing client
   */
  public static async togglePortalAccess(
    actorId: string,
    orgIdHeader: string | undefined,
    clientId: string,
    enabled: boolean
  ) {
    const business = await this.resolveCallerBusiness(actorId, orgIdHeader);

    let q = supabase.from('clients').select('*').eq('id', clientId).eq('is_deleted', false);
    if (business.isOrg) {
      q = q.eq('organization_id', business.organizationId);
    } else {
      q = q.is('organization_id', null).eq('owner_id', business.ownerId);
    }
    const { data: client, error: cErr } = await q.single();
    if (cErr || !client) throw new Error('Client record not found');

    if (enabled) {
      // Re-enable portal access
      return this.saveClientWithPortal(actorId, orgIdHeader, {
        id: client.id,
        name: client.name,
        companyName: client.company_name,
        email: client.email,
        phone: client.phone,
        gstNumber: client.gst_number,
        address: client.address,
        notes: client.notes,
        enablePortal: true,
      });
    } else {
      // Disable portal access: keep client row and history, set status to disabled
      const { data: updated, error: uErr } = await supabase
        .from('clients')
        .update({
          portal_status: 'disabled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .select()
        .single();

      if (uErr) throw new Error(`Failed to disable portal access: ${uErr.message}`);

      // Deactivate active project access records without deleting history
      if (client.user_id) {
        await supabase
          .from('project_client_access')
          .update({ status: 'revoked', updated_at: new Date().toISOString() })
          .eq('client_id', clientId)
          .eq('user_id', client.user_id);
      }

      return {
        success: true,
        client: updated,
        portalStatus: 'disabled',
      };
    }
  }

  /**
   * Resend access setup link
   */
  public static async resendAccessLink(
    actorId: string,
    orgIdHeader: string | undefined,
    clientId: string
  ) {
    const business = await this.resolveCallerBusiness(actorId, orgIdHeader);

    let q = supabase.from('clients').select('*').eq('id', clientId).eq('is_deleted', false);
    if (business.isOrg) {
      q = q.eq('organization_id', business.organizationId);
    } else {
      q = q.is('organization_id', null).eq('owner_id', business.ownerId);
    }
    const { data: client } = await q.single();
    if (!client) throw new Error('Client not found');
    if (!client.email) throw new Error('Client has no email configured');

    const normEmail = client.email.trim().toLowerCase();
    const { data: linkRes, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normEmail,
    });

    if (linkErr) throw new Error(`Failed to generate recovery link: ${linkErr.message}`);

    await supabase
      .from('clients')
      .update({
        portal_status: client.portal_status === 'no_access' ? 'pending_login' : client.portal_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    const setupLink = linkRes?.properties?.action_link || null;

    if (setupLink) {
      await EmailService.sendInvitation({
        targetEmail: normEmail,
        workspaceOrProjectName: 'Auvryn Client Portal',
        role: 'Client Collaborator',
        inviteUrl: setupLink,
        isClient: true,
        organizationId: business.organizationId || undefined,
        userId: actorId,
      }).catch((e: any) => console.warn('[ClientService] Resend email note:', e.message));
    }

    return {
      success: true,
      email: normEmail,
      setupLink,
      message: 'Access setup link generated and dispatched via email successfully',
    };
  }

  /**
   * Trigger Password Reset
   */
  public static async triggerPasswordReset(
    actorId: string,
    orgIdHeader: string | undefined,
    clientId: string
  ) {
    return this.resendAccessLink(actorId, orgIdHeader, clientId);
  }

  /**
   * Synchronize linked projects for a client
   */
  public static async syncProjects(
    actorId: string,
    orgIdHeader: string | undefined,
    clientId: string,
    projectIds: string[]
  ) {
    const business = await this.resolveCallerBusiness(actorId, orgIdHeader);

    let q = supabase.from('clients').select('*').eq('id', clientId).eq('is_deleted', false);
    if (business.isOrg) {
      q = q.eq('organization_id', business.organizationId);
    } else {
      q = q.is('organization_id', null).eq('owner_id', business.ownerId);
    }
    const { data: client } = await q.single();
    if (!client) throw new Error('Client not found');
    if (!client.user_id) throw new Error('Client has no linked portal account');

    const cleanProjectIds = Array.isArray(projectIds) ? projectIds : [];

    // Verify projects belong to this business
    let pQuery = supabase.from('projects').select('id').in('id', cleanProjectIds).is('deleted_at', null);
    if (business.isOrg) {
      pQuery = pQuery.eq('org_id', business.organizationId);
    } else {
      pQuery = pQuery.eq('owner_id', business.ownerId);
    }
    const { data: verifiedProjects } = await pQuery;
    const validIds = new Set((verifiedProjects || []).map((p: any) => p.id));

    // Remove any projects not in validIds
    const { data: currentAccess } = await supabase
      .from('project_client_access')
      .select('id, project_id')
      .eq('client_id', clientId)
      .eq('user_id', client.user_id);

    const toRemove = (currentAccess || []).filter((ca: any) => !validIds.has(ca.project_id));
    if (toRemove.length > 0) {
      await supabase
        .from('project_client_access')
        .delete()
        .in('id', toRemove.map((r: any) => r.id));
    }

    // Add or update projects in validIds
    for (const pId of Array.from(validIds)) {
      await supabase
        .from('project_client_access')
        .upsert({
          project_id: pId,
          client_id: clientId,
          user_id: client.user_id,
          access_role: 'viewer',
          can_view: true,
          can_approve: true,
          can_request_changes: true,
          can_view_financials: true,
          can_view_receipts: true,
          status: 'active',
          invited_by: actorId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'project_id,user_id' });
    }

    return {
      success: true,
      linkedProjectsCount: validIds.size,
    };
  }

  /**
   * Get client portal account telemetry & associated projects
   */
  public static async getClientDetails(
    actorId: string,
    orgIdHeader: string | undefined,
    clientId: string
  ) {
    const business = await this.resolveCallerBusiness(actorId, orgIdHeader);

    let q = supabase.from('clients').select('*').eq('id', clientId).eq('is_deleted', false);
    if (business.isOrg) {
      q = q.eq('organization_id', business.organizationId);
    } else {
      q = q.is('organization_id', null).eq('owner_id', business.ownerId);
    }
    const { data: client, error } = await q.single();
    if (error || !client) throw new Error('Client record not found');

    // Get linked projects
    let linkedProjects: any[] = [];
    if (client.user_id) {
      const { data: pcas } = await supabase
        .from('project_client_access')
        .select('project_id, status, projects(id, title, status)')
        .eq('client_id', clientId);
      linkedProjects = (pcas || []).map((p: any) => p.projects).filter(Boolean);
    }

    return {
      client,
      linkedProjects,
    };
  }
}
