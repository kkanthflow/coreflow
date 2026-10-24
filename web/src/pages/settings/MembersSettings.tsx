import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Shield, 
  Trash2, 
  Mail, 
  Check, 
  Lock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useRole } from '../../hooks/useRole';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
import {
  SettingsSection,
  SettingsRow,
  Select,
  SettingsSkeleton,
} from '../../components/settings';

interface OrgMember {
  userId: string;
  role: string;
  createdAt: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

const AVAILABLE_ROLES = [
  { value: 'owner', label: 'Owner (Full Access)' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'member', label: 'Team Member' },
  { value: 'freelancer', label: 'Freelancer / Contractor' },
  { value: 'client', label: 'Client (Portal Only)' },
];

export default function MembersSettings() {
  const { user } = useAuth();
  const { orgId, orgName } = useWorkspace();
  const { canEditWorkspace } = useSettings();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          user_id,
          role,
          created_at,
          users:user_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('org_id', orgId);

      if (error) throw error;

      const formatted: OrgMember[] = (data || []).map((row: any) => {
        const u = Array.isArray(row.users) ? row.users[0] : row.users;
        return {
          userId: row.user_id,
          role: row.role || 'member',
          createdAt: row.created_at || new Date().toISOString(),
          fullName: u?.full_name || 'Team Member',
          email: u?.email || 'member@workspace.com',
          avatarUrl: u?.avatar_url || '',
        };
      });

      setMembers(formatted);
    } catch (err: any) {
      console.warn('Error fetching organization members:', err);
      // Fallback: Show current user if standalone
      if (user) {
        setMembers([
          {
            userId: user.id,
            role: 'owner',
            createdAt: new Date().toISOString(),
            fullName: user.user_metadata?.full_name || 'Workspace Owner',
            email: user.email || '',
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, user]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = async (memberUserId: string, newRole: string) => {
    if (!canEditWorkspace || !orgId) return;
    setUpdatingRoleId(memberUserId);
    try {
      const { error } = await supabase
        .from('user_organizations')
        .update({ role: newRole })
        .eq('user_id', memberUserId)
        .eq('org_id', orgId);

      if (error) throw error;

      setMembers((prev) =>
        prev.map((m) => (m.userId === memberUserId ? { ...m, role: newRole } : m))
      );
      toast.success('Member role updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member role');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemoveMember = async (member: OrgMember) => {
    if (!canEditWorkspace || !orgId) return;
    if (member.userId === user?.id) {
      toast.error('You cannot remove yourself from the organization');
      return;
    }
    if (member.role === 'owner') {
      toast.error('The primary organization owner cannot be removed');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${member.fullName} (${member.email}) from ${orgName}?`)) {
      return;
    }

    setRemovingMemberId(member.userId);
    try {
      const { error } = await supabase
        .from('user_organizations')
        .delete()
        .eq('user_id', member.userId)
        .eq('org_id', orgId);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      toast.success(`${member.fullName} has been removed from the organization`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── Organization Members Table & Roster ── */}
      <SettingsSection
        label={`Organization Members (${members.length})`}
        description="Manage workspace team access, permissions, and administrative privilege levels."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMembers}
              disabled={loading}
              title="Refresh roster"
              className="p-1 text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            {canEditWorkspace && (
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={13} />
                <span>Invite Member</span>
              </button>
            )}
          </div>
        }
      >
        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-line bg-surface-2/30">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members by name, email, or role..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-surface-2 border border-line text-xs text-text placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Members List */}
        {loading ? (
          <SettingsSkeleton rows={3} />
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No organization members match your query.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filteredMembers.map((member) => {
              const isSelf = member.userId === user?.id;
              const isOwner = member.role === 'owner';
              const canEditThisMember = canEditWorkspace && !isSelf && !isOwner;

              return (
                <div
                  key={member.userId}
                  className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/30 transition-colors"
                >
                  {/* Left: Avatar + Identity */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-surface-2 border border-line flex items-center justify-center font-bold text-text overflow-hidden shrink-0">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-mono">
                          {member.fullName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-text truncate">
                          {member.fullName}
                        </span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-accent-soft text-accent border border-accent/20">
                            You
                          </span>
                        )}
                        {isOwner && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted font-mono truncate mt-0.5">
                        {member.email} · Joined {new Date(member.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Right: Role Select & Removal */}
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pl-13 sm:pl-0">
                    {canEditThisMember ? (
                      <Select
                        value={member.role}
                        disabled={updatingRoleId === member.userId}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        options={AVAILABLE_ROLES}
                        size="sm"
                      />
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider bg-surface-2 border border-line text-muted">
                        {member.role}
                      </span>
                    )}

                    {canEditThisMember && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member)}
                        disabled={removingMemberId === member.userId}
                        title={`Remove ${member.fullName}`}
                        className="p-2 text-muted hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {/* ── Invite Member Modal / State ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-accent" />
                <h3 className="font-bold text-sm text-text">Invite Team Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-muted hover:text-text text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2 text-xs">
              <div className="font-semibold text-text flex items-center gap-1.5">
                <Lock size={12} className="text-muted" />
                <span>Direct Email Invitations</span>
              </div>
              <p className="text-muted leading-relaxed">
                Direct external email dispatch via secure invite tokens is currently enabled for client project rooms and onboarding flows. Dedicated workspace seat invitation endpoints will be available in the upcoming release.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
