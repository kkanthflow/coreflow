import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Zap,
  Search,
} from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../../../../server/workflows/workflow.templates.js';

export default function WorkflowTemplates() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = WORKFLOW_TEMPLATES.filter((t) => {
    const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleUseTemplate = (template: any) => {
    navigate('/workflows/new', { state: { template } });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-divider pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/workflows"
            className="p-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-muted hover:text-main transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#FF6B4A]" />
              <h1 className="text-2xl font-extrabold text-main tracking-tight">Automation Templates</h1>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Production-ready workflow architectures covering project routing, approvals, escalations & integrations.
            </p>
          </div>
        </div>

        <Link
          to="/workflows/new"
          className="px-4 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,107,74,0.3)] flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Zap size={14} />
          <span>Blank Workflow</span>
        </Link>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card-bg border border-divider">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by keyword, category, or action..."
            className="w-full bg-hover/50 border border-divider rounded-xl pl-9 pr-4 py-2 text-xs text-main placeholder-muted focus:outline-none focus:border-[#FF6B4A]/50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-hover/50 border border-divider rounded-xl px-3 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]/50"
        >
          <option value="all">All 10 Categories</option>
          <option value="project_task">A. Project & Tasks</option>
          <option value="deadline_reminder">B. Deadlines & Escalation</option>
          <option value="team_notifications">C. Team Notifications</option>
          <option value="approval">D. Approvals</option>
          <option value="recurring_task">E. Recurring Tasks</option>
          <option value="project_status">F. Project Status</option>
          <option value="client_onboarding">G. Client Onboarding</option>
          <option value="form_request">H. Form Requests</option>
          <option value="webhook">I. Webhooks</option>
          <option value="exception_escalation">J. Exceptions</option>
        </select>
      </div>

      {/* ── Template Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tmpl, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-card-bg border border-divider hover:border-divider-strong transition-all flex flex-col justify-between group space-y-4 shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-hover border border-divider text-muted">
                  {tmpl.category.replace('_', ' ')}
                </span>
                <span className="text-[11px] font-mono text-[#FF6B4A] flex items-center gap-1 font-semibold">
                  <Zap size={11} />
                  <span>{tmpl.trigger_type.replace('_', ' ')}</span>
                </span>
              </div>

              <h3 className="text-base font-bold text-main group-hover:text-[#FF6B4A] transition-colors">
                {tmpl.name}
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-3">
                {tmpl.description}
              </p>

              {/* Step Summary Badges */}
              <div className="mt-4 pt-3 border-t border-divider/60 space-y-1.5 text-[11px] font-mono text-muted">
                <div className="flex items-center gap-2">
                  <span className="text-main font-semibold">Pipeline:</span>
                  <span>
                    {tmpl.conditions.length} condition{tmpl.conditions.length === 1 ? '' : 's'} · {tmpl.actions.length} action{tmpl.actions.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleUseTemplate(tmpl)}
              className="w-full py-2.5 px-4 rounded-xl bg-hover group-hover:bg-[#FF6B4A] group-hover:text-white border border-divider group-hover:border-[#FF6B4A] text-xs font-semibold text-main transition-all flex items-center justify-center gap-2"
            >
              <span>Use This Template</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
