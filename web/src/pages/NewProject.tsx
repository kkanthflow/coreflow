import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '../components/ui/ObsidianPrimitives';
import { toast } from '../components/ui/Toast';

const COVER_COLORS = [
  '#FF6B4A', '#60A5FA', '#34D399', '#FBBF24',
  '#A78BFA', '#F472B6', '#22D3EE', '#FB923C'
];

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId } = useWorkspace();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);
  const [dueDate, setDueDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadDepts() {
      if (!orgId) return;
      const { data } = await supabase.from('departments').select('id, name').eq('org_id', orgId);
      setDepartments(data || []);
    }
    loadDepts();
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      // Use SECURITY DEFINER RPC to atomically create project + owner membership
      const { data, error } = await supabase.rpc('create_project_with_member', {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_priority: priority,
        p_cover_color: coverColor,
        p_status: 'active',
        p_due_date: dueDate || null,
        p_department_id: departmentId || null,
        p_org_id: orgId || null,
      });

      if (error) throw error;

      const createdProj = data;
      if (createdProj?.id) {
        toast.success('Project initialized successfully');
        navigate(`/projects/${createdProj.id}`);
      }
    } catch (e: any) {
      console.error('Failed to create project:', e);
      setErrorMsg(e.message || 'Failed to create project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      <PageHeader
        title="Initialize New Project"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'New Workstream' }
        ]}
        description="Establish goals, deliverable milestones, and team ownership."
        actions={
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Cancel</span>
          </button>
        }
      />

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleCreate} className="max-w-2xl bg-card-bg border border-divider rounded-lg p-5 sm:p-6 space-y-5">
        <div>
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
            Workstream Title <span className="text-[#FF6B4A]">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Next-Gen Mobile App Architecture Overhaul"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3.5 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
            Scope & Specifications
          </label>
          <textarea
            rows={3}
            placeholder="Technical goals, target deliverables, architecture requirements..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3.5 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main focus:outline-none transition-colors"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Critical Priority</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
              Target Deadline
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main focus:outline-none transition-colors"
            />
          </div>
        </div>

        {orgId && departments.length > 0 && (
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
              Department
            </label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main focus:outline-none transition-colors"
            >
              <option value="">General / Cross-functional</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
            Accent Trajectory Color
          </label>
          <div className="flex gap-2 flex-wrap pt-1">
            {COVER_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCoverColor(c)}
                className={`w-6 h-6 rounded-[2px] transition-all ${coverColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D12]' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-divider">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-hover hover:bg-hover text-muted text-xs font-medium rounded border border-divider transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm"
          >
            <Save size={13} />
            <span>{saving ? 'Creating...' : 'Initialize Project'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
