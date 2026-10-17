import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  ShieldCheck, 
  Search, 
  Activity, 
  FileText, 
  Users, 
  Briefcase, 
  CheckSquare 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'project' | 'task' | 'file' | 'organization'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [user, activeTab]);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    
    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        created_at,
        actor:actor_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (activeTab !== 'all') {
      query = query.eq('resource_type', activeTab);
    }

    const { data } = await query;
    if (data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const formatMessage = (log: any) => {
    const actorName = log.actor?.name || log.actor?.email || 'System';
    const action = log.action?.replace(/_/g, ' ') || 'unknown action';
    return `${actorName} ${action}`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'project': return <Briefcase size={16} className="text-blue-500" />;
      case 'task': return <CheckSquare size={16} className="text-green-500" />;
      case 'file': return <FileText size={16} className="text-orange-500" />;
      case 'organization': return <Users size={16} className="text-purple-500" />;
      default: return <Activity size={16} className="text-zinc-500" />;
    }
  };

  const filteredLogs = logs.filter(log => 
    formatMessage(log).toLowerCase().includes(searchTerm.toLowerCase()) || 
    (log.resource_type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="text-[#FF6B4A]" size={24} />
            <h1 className="text-2xl font-bold text-main tracking-tight">Organization Audit Log</h1>
          </div>
          <p className="text-sm text-muted">Immutable history of all significant security and access events.</p>
        </div>
      </div>

      <div className="bg-card-bg border border-divider rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-divider flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Tabs */}
          <div className="flex bg-app p-1 rounded-lg border border-divider w-full sm:w-auto overflow-x-auto">
            {['all', 'project', 'task', 'file', 'organization'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                  activeTab === tab 
                    ? 'bg-card-bg text-main shadow-sm border border-divider' 
                    : 'text-muted hover:text-main'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder="Search audit events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-app border border-divider rounded-lg pl-9 pr-3 py-2 text-xs text-main placeholder:text-muted focus:outline-none focus:border-[#FF6B4A]/50 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-app border-b border-divider text-xs text-muted uppercase tracking-wider font-mono">
              <tr>
                <th className="px-6 py-4 font-semibold">Event / Action</th>
                <th className="px-6 py-4 font-semibold">Resource</th>
                <th className="px-6 py-4 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-muted">
                    <div className="animate-pulse flex flex-col items-center">
                      <Activity className="mb-2 text-zinc-500" size={24} />
                      Loading securely...
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-muted">
                    <ShieldCheck className="mx-auto mb-2 opacity-50" size={24} />
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-app border border-divider flex items-center justify-center shrink-0">
                          {getIcon(log.resource_type)}
                        </div>
                        <div>
                          <div className="font-semibold text-main text-xs">{formatMessage(log)}</div>
                          <div className="text-[10px] text-muted mt-0.5">Actor: {log.actor?.email || 'System'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center px-2 py-1 rounded bg-app border border-divider text-[10px] uppercase font-mono tracking-wider text-muted">
                        {log.resource_type}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-muted">
                        {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : 'Unknown'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
