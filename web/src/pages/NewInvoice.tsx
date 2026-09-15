import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { PageHeader } from '../components/ui/ObsidianPrimitives';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  tax_rate: number;
  discount: number;
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, defaultCurrency } = useWorkspace();

  const [clients, setClients] = useState<{ id: string; name: string; company_name: string }[]>([]);

  // Form State
  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [currency, setCurrency] = useState(defaultCurrency || 'USD');
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: 'Consulting / Engineering Deliverables', quantity: 1, rate: 500, tax_rate: 0, discount: 0 }
  ]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadClients() {
      if (!user) return;
      try {
        let q = supabase.from('clients').select('id, name, company_name').eq('is_deleted', false);
        if (orgId) q = q.eq('organization_id', orgId);
        else q = q.eq('owner_id', user.id);
        const { data } = await q;
        setClients(data || []);
        if (data && data.length > 0) setClientId(data[0].id);
      } catch (e) {
        console.error('Failed to load clients:', e);
      }
    }
    loadClients();
  }, [user, orgId]);

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: String(Date.now()), description: '', quantity: 1, rate: 0, tax_rate: 0, discount: 0 }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, val: any) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: val } : item)));
  };

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
  const totalTax = items.reduce((acc, item) => acc + (item.quantity * item.rate * (item.tax_rate / 100)), 0);
  const totalDiscount = items.reduce((acc, item) => acc + (item.discount || 0), 0);
  const totalAmount = Math.max(0, subtotal + totalTax - totalDiscount);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setErrorMsg('Please select a client account.');
      return;
    }
    if (!user || items.length === 0) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;

      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .insert({
          organization_id: orgId || null,
          owner_id: user.id,
          creator_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber || null,
          issue_date: issueDate,
          due_date: dueDate,
          currency,
          subtotal,
          tax_amount: totalTax,
          discount_amount: totalDiscount,
          total_amount: totalAmount,
          paid_amount: 0,
          balance_due: totalAmount,
          cgst,
          sgst,
          status: orgId ? 'sent' : 'draft',
          template_style: 'classic',
        })
        .select()
        .single();

      if (invError) throw invError;

      const formattedItems = items.map(it => {
        const lineSub = (it.quantity * it.rate) - (it.discount || 0);
        const lineTax = lineSub * (it.tax_rate / 100);
        return {
          invoice_id: invData.id,
          description: it.description || 'Service item',
          quantity: it.quantity,
          rate: it.rate,
          tax_rate: it.tax_rate,
          discount: it.discount || 0,
          tax_amount: lineTax,
          amount: lineSub,
        };
      });

      const { error: itemsError } = await supabase.from('invoice_items').insert(formattedItems);
      if (itemsError) throw itemsError;

      navigate(`/invoices/${invData.id}`);
    } catch (e: any) {
      console.error('Failed to create invoice:', e);
      setErrorMsg(e.message || 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      <PageHeader
        title="Generate Invoice & Billing Claim"
        breadcrumbs={[
          { label: 'Invoices', href: '/invoices' },
          { label: 'New Invoice' }
        ]}
        description="Standardized enterprise invoicing with automated tax breakdown and ledger tracking."
        actions={
          <button
            onClick={() => navigate('/invoices')}
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

      <form onSubmit={handleCreate} className="max-w-4xl bg-card-bg border border-divider rounded-lg p-5 sm:p-6 space-y-5">
        
        {/* Invoice Metadata Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
              Client Account <span className="text-[#FF6B4A]">*</span>
            </label>
            <select
              required
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company_name || c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
              Invoice Identifier <span className="text-[#FF6B4A]">*</span>
            </label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-2.5 py-1.5 text-xs text-main font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
              Issue Date
            </label>
            <input
              type="date"
              required
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
              className="w-full bg-[#07080B] border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
              Due Date
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-[#07080B] border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3 pt-3 border-t border-divider">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-main">Line Items Breakdown</span>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 px-2.5 py-1 bg-hover hover:bg-hover text-main text-xs font-semibold rounded border border-divider transition-colors"
            >
              <Plus size={12} />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-[#07080B] p-2.5 rounded border border-divider">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Deliverable description or engineering service..."
                    required
                    value={it.description}
                    onChange={e => updateItem(it.id, 'description', e.target.value)}
                    className="w-full bg-transparent border-0 text-xs text-main placeholder-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto font-mono text-xs">
                  <div className="w-16">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={e => updateItem(it.id, 'quantity', parseFloat(e.target.value) || 1)}
                      className="w-full bg-card-bg border border-divider rounded px-2 py-1 text-right text-main focus:outline-none"
                    />
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Rate"
                      value={it.rate}
                      onChange={e => updateItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full bg-card-bg border border-divider rounded px-2 py-1 text-right text-main focus:outline-none"
                    />
                  </div>

                  <div className="w-16">
                    <input
                      type="number"
                      placeholder="Tax%"
                      value={it.tax_rate}
                      onChange={e => updateItem(it.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                      className="w-full bg-card-bg border border-divider rounded px-2 py-1 text-right text-main focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={items.length <= 1}
                    className="p-1 text-muted hover:text-red-400 disabled:opacity-20 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Currency & Financial Totals */}
        <div className="pt-4 border-t border-divider flex flex-col sm:flex-row justify-between items-end gap-4">
          <div className="w-full sm:max-w-xs">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
              Billing Currency
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full bg-[#07080B] border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
              <option value="AUD">AUD ($)</option>
            </select>
          </div>

          <div className="w-full sm:max-w-xs space-y-1.5 text-xs bg-[#07080B] p-3.5 rounded border border-divider font-mono tabular-nums">
            <div className="flex justify-between text-muted">
              <span>Subtotal:</span>
              <span className="text-main font-medium">{currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Tax ({totalTax > 0 ? 'Calculated' : '0%'}):</span>
              <span className="text-main font-medium">{currency} {totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-divider text-xs font-bold text-main">
              <span>Total Balance Due:</span>
              <span className="text-[#FF6B4A] text-sm">{currency} {totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-divider">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-3.5 py-1.5 bg-hover hover:bg-hover text-muted text-xs rounded border border-divider transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !clientId || items.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm"
          >
            <Save size={13} />
            <span>{saving ? 'Creating...' : 'Issue Invoice'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
