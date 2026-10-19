import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  InvoiceStudioToolbar
} from '../components/invoices/InvoiceStudioToolbar';
import {
  InvoiceStudioLeftPanel
} from '../components/invoices/InvoiceStudioLeftPanel';
import type { LeftPanelTab } from '../components/invoices/InvoiceStudioLeftPanel';
import {
  InvoiceStudioRightPanel
} from '../components/invoices/InvoiceStudioRightPanel';
import {
  StudioInteractiveCanvas
} from '../components/invoices/StudioInteractiveCanvas';
import { INVOICE_TEMPLATES } from '../components/invoices/templateGalleryData';
import type {
  CanvasElement,
  InvoiceStudioDocV2,
  InvoiceTemplateId,
  StudioDesignProperties,
  StudioLineItem,
} from '../types/invoiceStudio';
import {
  createDefaultElementsForTemplate,
  validateOrMigrateDoc,
  checkSaveConflict,
  generateStableId,
  CANVAS_A4_WIDTH,
  CANVAS_A4_HEIGHT
} from '../components/invoices/studioDocumentMigration';
import {
  createInitialHistory,
  pushHistoryState,
  undoHistory,
  redoHistory,
  canUndo as checkCanUndo,
  canRedo as checkCanRedo,
  type StudioHistoryState,
} from '../components/invoices/studioHistory';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Users,
  X
} from 'lucide-react';

interface ClientAccount {
  id: string;
  name: string;
  company_name: string;
  email?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const { id: routeInvoiceId } = useParams<{ id?: string }>();
  const isExistingInvoice = Boolean(routeInvoiceId);

  const { user } = useAuth();
  const { orgId, orgName, orgAddress, orgGst, defaultCurrency } = useWorkspace();
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);

  // ── Layout & Viewport State ──
  const [activeTab, setActiveTab] = useState<LeftPanelTab>('templates');
  const [zoom, setZoom] = useState<number>(100);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'conflict'>('saved');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<{
    message: string;
    feature: string;
    upgradeUrl: string;
  } | null>(null);

  // ── Data State ──
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [clientId, setClientId] = useState<string>('');
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // ── Quick Client Registration Modal State ──
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false);
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientCompany, setNewClientCompany] = useState<string>('');
  const [newClientEmail, setNewClientEmail] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [newClientGst, setNewClientGst] = useState<string>('');
  const [newClientAddress, setNewClientAddress] = useState<string>('');
  const [isSubmittingClient, setIsSubmittingClient] = useState<boolean>(false);
  const [clientSaveError, setClientSaveError] = useState<string | null>(null);

  // ── Invoice Core Metadata ──
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    `INV-${Date.now().toString().slice(-6)}`
  );
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [currency, setCurrency] = useState<string>(defaultCurrency || 'USD');

  // ── Line Items State ──
  const [items, setItems] = useState<StudioLineItem[]>([
    {
      id: '1',
      description: 'Consulting / Engineering Deliverables',
      quantity: 1,
      rate: 500,
      tax_rate: 18,
      discount: 0,
    },
  ]);

  // ── Global Design Properties ──
  const [properties, setProperties] = useState<StudioDesignProperties>({
    templateId: 'modern_minimalist',
    accentColor: '#FF6B4A',
    fontFamily: 'sans',
    density: 'comfortable',
    printTheme: 'light',
    showGstBreakdown: true,
    showBankDetails: true,
    showSignatureBlock: true,
    showNotesTerms: true,
    bankName: 'HDFC Bank',
    accountNumber: '99820019284102',
    ifscCode: 'HDFC0001242',
    upiId: 'billing@auvryn',
    customNotes: 'Thank you for your business. For billing queries contact billing@auvryn.com',
    paymentTerms: 'Payment due within 15 days of invoice date',
    logoUrl: '',
    logoPosition: 'left',
  });

  // ── Phase 3: Interactive Canvas & History State ──
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [history, setHistory] = useState<StudioHistoryState>(() => {
    const initialDoc: InvoiceStudioDocV2 = {
      version: 2,
      revision: 1,
      canvas: {
        width: CANVAS_A4_WIDTH,
        height: CANVAS_A4_HEIGHT,
        backgroundColor: '#ffffff',
        theme: 'light',
      },
      elements: createDefaultElementsForTemplate('modern_minimalist', {
        templateId: 'modern_minimalist',
        accentColor: '#FF6B4A',
        fontFamily: 'sans',
        density: 'comfortable',
        printTheme: 'light',
        showGstBreakdown: true,
        showBankDetails: true,
        showSignatureBlock: true,
        showNotesTerms: true,
        bankName: 'HDFC Bank',
        accountNumber: '99820019284102',
        ifscCode: 'HDFC0001242',
        upiId: 'billing@auvryn',
        customNotes: 'Thank you for your business.',
        paymentTerms: 'Net 15 Days',
        logoUrl: '',
        logoPosition: 'left',
      }),
      properties: {
        templateId: 'modern_minimalist',
        accentColor: '#FF6B4A',
        fontFamily: 'sans',
        density: 'comfortable',
        printTheme: 'light',
        showGstBreakdown: true,
        showBankDetails: true,
        showSignatureBlock: true,
        showNotesTerms: true,
        bankName: 'HDFC Bank',
        accountNumber: '99820019284102',
        ifscCode: 'HDFC0001242',
        upiId: 'billing@auvryn',
        customNotes: 'Thank you for your business.',
        paymentTerms: 'Net 15 Days',
        logoUrl: '',
        logoPosition: 'left',
      },
      updatedAt: new Date().toISOString(),
    };
    return createInitialHistory(initialDoc);
  });

  const activeDoc = history.present;

  // ── Load Clients & Existing Invoice (if editing) ──
  useEffect(() => {
    async function initialize() {
      if (!user) return;
      setLoadingInitial(true);
      try {
        // 1. Fetch Clients
        let q = supabase
          .from('clients')
          .select('id, name, company_name, email, phone, address, gst_number')
          .eq('is_deleted', false);

        if (orgId) {
          q = q.eq('organization_id', orgId);
        } else {
          q = q.eq('owner_id', user.id);
        }

        const { data: clientList, error: clientError } = await q;
        if (clientError) throw clientError;

        setClients(clientList || []);
        if (clientList && clientList.length > 0 && !routeInvoiceId) {
          setClientId(clientList[0].id);
        }

        // 2. If editing existing invoice, load its data and visual_recreation document
        if (routeInvoiceId) {
          const { data: invData, error: invError } = await supabase
            .from('invoices')
            .select(`
              *,
              invoice_items(*)
            `)
            .eq('id', routeInvoiceId)
            .single();

          if (invError) throw invError;
          if (invData) {
            setClientId(invData.client_id || '');
            setInvoiceNumber(invData.invoice_number || `INV-${routeInvoiceId.slice(0, 6)}`);
            setIssueDate(invData.issue_date || new Date().toISOString().split('T')[0]);
            setDueDate(invData.due_date || new Date().toISOString().split('T')[0]);
            setCurrency(invData.currency || defaultCurrency || 'USD');

            // Format line items
            if (Array.isArray(invData.invoice_items) && invData.invoice_items.length > 0) {
              setItems(
                invData.invoice_items.map((it: any) => ({
                  id: it.id || String(Date.now()),
                  description: it.description || '',
                  quantity: it.quantity || 1,
                  rate: it.rate || 0,
                  tax_rate: it.tax_rate || 0,
                  discount: it.discount || 0,
                  hsn_code: it.hsn_code || undefined,
                }))
              );
            }

            // Migrate or validate existing visual_recreation
            const migratedDoc = validateOrMigrateDoc(invData.visual_recreation, properties);
            setProperties(migratedDoc.properties);
            setHistory(createInitialHistory(migratedDoc));
            setSaveStatus('saved');
          }
        }
      } catch (err) {
        console.error('Failed to initialize invoice studio:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    initialize();
  }, [user, orgId, routeInvoiceId]);

  // ── Financial Calculations ──
  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const totalTax = items.reduce(
    (acc, item) => acc + item.quantity * item.rate * (item.tax_rate / 100),
    0
  );
  const totalDiscount = items.reduce((acc, item) => acc + (item.discount || 0), 0);
  const totalAmount = Math.max(0, subtotal + totalTax - totalDiscount);

  // ── Measure available column width with ResizeObserver for responsive fit ──
  useEffect(() => {
    if (!viewportContainerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(viewportContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Responsive Fit-to-Width Scaling:
  // At zoom = 100%, the invoice scales to fit the available column width.
  // Zoom controls scale on top of the fit scale.
  const availableColumnWidth = containerWidth ? Math.max(280, containerWidth - 48) : CANVAS_A4_WIDTH;
  const fitWidthScale = Math.min(1.0, availableColumnWidth / CANVAS_A4_WIDTH);
  const effectiveScale = Math.max(0.25, Math.min(2.5, fitWidthScale * (zoom / 100)));

  // ── Fit to Page / Screen (Resets zoom to 100% fit-to-width) ──
  const handleFitToPage = useCallback(() => {
    setZoom(100);
  }, []);

  // ── Document Element Manipulation Handlers ──
  const handleUpdateElement = useCallback(
    (id: string, updates: Partial<CanvasElement>, recordHistory: boolean = false) => {
      setHistory((prevHistory) => {
        const nextElements = prevHistory.present.elements.map((el) =>
          el.id === id ? ({ ...el, ...updates } as CanvasElement) : el
        );
        const nextDoc: InvoiceStudioDocV2 = {
          ...prevHistory.present,
          elements: nextElements,
        };

        if (recordHistory) {
          return pushHistoryState(prevHistory, nextDoc);
        } else {
          return {
            ...prevHistory,
            present: nextDoc,
          };
        }
      });
      setSaveStatus('dirty');
    },
    []
  );

  const handleAddCanvasElement = useCallback(
    (newEl: CanvasElement) => {
      setHistory((prevHistory) => {
        const nextDoc: InvoiceStudioDocV2 = {
          ...prevHistory.present,
          elements: [...prevHistory.present.elements, newEl],
        };
        return pushHistoryState(prevHistory, nextDoc);
      });
      setSelectedElementId(newEl.id);
      setSaveStatus('dirty');
    },
    []
  );

  const handleDeleteElement = useCallback(
    (id: string) => {
      setHistory((prevHistory) => {
        const nextDoc: InvoiceStudioDocV2 = {
          ...prevHistory.present,
          elements: prevHistory.present.elements.filter((el) => el.id !== id),
        };
        return pushHistoryState(prevHistory, nextDoc);
      });
      if (selectedElementId === id) setSelectedElementId(null);
      setSaveStatus('dirty');
    },
    [selectedElementId]
  );

  const handleDuplicateElement = useCallback(
    (id: string) => {
      const target = activeDoc.elements.find((el) => el.id === id);
      if (!target) return;

      const duplicated: CanvasElement = {
        ...target,
        id: generateStableId(`${target.type}_copy`),
        name: `${target.name} Copy`,
        x: Math.min(CANVAS_A4_WIDTH - target.width, target.x + 20),
        y: Math.min(CANVAS_A4_HEIGHT - target.height, target.y + 20),
        zIndex: activeDoc.elements.length + 1,
      };

      handleAddCanvasElement(duplicated);
    },
    [activeDoc.elements, handleAddCanvasElement]
  );

  const handleReorderLayer = useCallback(
    (direction: 'up' | 'down' | 'front' | 'back') => {
      if (!selectedElementId) return;
      const index = activeDoc.elements.findIndex((el) => el.id === selectedElementId);
      if (index === -1) return;

      const newElements = [...activeDoc.elements];
      const target = newElements[index];

      if (direction === 'up' && index < newElements.length - 1) {
        newElements[index] = newElements[index + 1];
        newElements[index + 1] = target;
      } else if (direction === 'down' && index > 0) {
        newElements[index] = newElements[index - 1];
        newElements[index - 1] = target;
      } else if (direction === 'front') {
        newElements.splice(index, 1);
        newElements.push(target);
      } else if (direction === 'back') {
        newElements.splice(index, 1);
        newElements.unshift(target);
      }

      // Reindex z-indexes
      const reindexed = newElements.map((el, i) => ({ ...el, zIndex: i + 1 }));
      setHistory((prev) => pushHistoryState(prev, { ...prev.present, elements: reindexed }));
      setSaveStatus('dirty');
    },
    [selectedElementId, activeDoc.elements]
  );

  // ── Undo & Redo Handlers ──
  const handleUndo = useCallback(() => {
    setHistory((prev) => undoHistory(prev));
    setSaveStatus('dirty');
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => redoHistory(prev));
    setSaveStatus('dirty');
  }, []);

  // ── Line Items Handlers ──
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: '',
        quantity: 1,
        rate: 0,
        tax_rate: 18,
        discount: 0,
      },
    ]);
    setSaveStatus('dirty');
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSaveStatus('dirty');
  };

  const handleUpdateItem = (id: string, field: keyof StudioLineItem, val: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    );
    setSaveStatus('dirty');
  };

  // ── Design Properties & Template Switcher ──
  const handleUpdateProperties = (partial: Partial<StudioDesignProperties>) => {
    const updatedProps = { ...properties, ...partial };
    setProperties(updatedProps);

    setHistory((prev) => {
      const nextDoc: InvoiceStudioDocV2 = {
        ...prev.present,
        properties: updatedProps,
        canvas: {
          ...prev.present.canvas,
          theme: updatedProps.printTheme,
          backgroundColor: updatedProps.printTheme === 'dark' ? '#090A0F' : '#ffffff',
        },
      };
      return pushHistoryState(prev, nextDoc);
    });
    setSaveStatus('dirty');
  };

  const handleSelectTemplate = (templateId: InvoiceTemplateId) => {
    const tmpl = INVOICE_TEMPLATES.find((t) => t.id === templateId);
    const updatedProps: StudioDesignProperties = {
      ...properties,
      templateId,
      accentColor: tmpl?.defaultAccent || properties.accentColor,
      fontFamily: tmpl?.defaultFont || properties.fontFamily,
      printTheme: tmpl?.defaultPrintTheme || properties.printTheme,
    };
    setProperties(updatedProps);

    // Regenerate structured template layout
    const newElements = createDefaultElementsForTemplate(templateId, updatedProps);
    setHistory((prev) => {
      const nextDoc: InvoiceStudioDocV2 = {
        ...prev.present,
        properties: updatedProps,
        canvas: {
          ...prev.present.canvas,
          theme: updatedProps.printTheme,
          backgroundColor: updatedProps.printTheme === 'dark' ? '#090A0F' : '#ffffff',
        },
        elements: newElements,
      };
      return pushHistoryState(prev, nextDoc);
    });
    setSelectedElementId(null);
    setSaveStatus('dirty');
  };

  // ── Selected Client Lookup & Fallback Demo Client ──
  const selectedClient = clients.find((c) => c.id === clientId) || null;

  const fallbackClient = {
    name: 'Alex Morgan',
    companyName: 'Acme Technologies Pvt Ltd',
    email: 'billing@acmecorp.com',
    phone: '+91 98765 43210',
    address: '100 Innovation Park, Tech Hub, Bengaluru 560001',
    gstNumber: '29ABCDE1234F1Z5',
  };

  const activeClientData = selectedClient
    ? {
        name: selectedClient.name,
        companyName: selectedClient.company_name,
        email: selectedClient.email,
        phone: selectedClient.phone,
        address: selectedClient.address,
        gstNumber: selectedClient.gst_number,
      }
    : fallbackClient;

  // ── Inline Client Creation Handler ──
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !user) return;
    setIsSubmittingClient(true);
    setClientSaveError(null);

    try {
      const payload: any = {
        owner_id: user.id,
        name: newClientName.trim(),
        company_name: newClientCompany.trim() || newClientName.trim(),
        email: newClientEmail.trim() || null,
        phone: newClientPhone.trim() || null,
        gst_number: newClientGst.trim() || null,
        address: newClientAddress.trim() || null,
      };
      if (orgId) payload.organization_id = orgId;

      const { data, error } = await supabase
        .from('clients')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setClients((prev) => [data, ...prev]);
        setClientId(data.id);
        setSaveStatus('dirty');
        setErrorMsg(null);
        setIsClientModalOpen(false);
        setNewClientName('');
        setNewClientCompany('');
        setNewClientEmail('');
        setNewClientPhone('');
        setNewClientGst('');
        setNewClientAddress('');
      }
    } catch (err: any) {
      console.error('Failed to create client:', err);
      setClientSaveError(err.message || 'Failed to save client');
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // ── Seller Profile Info ──
  const seller = {
    name: (orgName || 'Skavelon Technologies').replace(/SkavelonTEchnologies/i, 'Skavelon Technologies'),
    address: orgAddress || 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13',
    phone: '6385582453',
    email: 'skavelontechnologies@gmail.com',
    gstNumber: orgGst || '',
  };

  // ── High-Resolution PDF Export ──
  const handleDownloadPDF = async () => {
    if (!canvasRef.current) return;
    try {
      const element = canvasRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: properties.printTheme === 'dark' ? '#090A0F' : '#ffffff',
        width: CANVAS_A4_WIDTH,
        height: CANVAS_A4_HEIGHT,
        windowWidth: CANVAS_A4_WIDTH,
        windowHeight: CANVAS_A4_HEIGHT,
        onclone: (_clonedDoc, clonedEl) => {
          clonedEl.style.transform = 'none';
          let p = clonedEl.parentElement;
          while (p && p !== _clonedDoc.body) {
            p.style.transform = 'none';
            p = p.parentElement;
          }
        },
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${invoiceNumber || 'invoice'}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    }
  };

  // ── High-Resolution PNG Snapshot Export ──
  const handleDownloadPNG = async () => {
    if (!canvasRef.current) return;
    try {
      const element = canvasRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: properties.printTheme === 'dark' ? '#090A0F' : '#ffffff',
        width: CANVAS_A4_WIDTH,
        height: CANVAS_A4_HEIGHT,
        windowWidth: CANVAS_A4_WIDTH,
        windowHeight: CANVAS_A4_HEIGHT,
        onclone: (_clonedDoc, clonedEl) => {
          clonedEl.style.transform = 'none';
          let p = clonedEl.parentElement;
          while (p && p !== _clonedDoc.body) {
            p.style.transform = 'none';
            p = p.parentElement;
          }
        },
      });
      const link = document.createElement('a');
      link.download = `${invoiceNumber || 'invoice'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate PNG:', err);
    }
  };

  // ── Save & Issue Invoice via Supabase ──
  const handleSaveInvoice = async () => {
    if (!clientId) {
      setErrorMsg('Please select or register a client account before issuing this invoice.');
      setIsClientModalOpen(true);
      return;
    }
    if (!user || items.length === 0) return;

    setIsSaving(true);
    setSaveStatus('saving');
    setErrorMsg(null);
    setQuotaError(null);

    try {
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;

      // Check for stale saves if editing existing invoice
      if (routeInvoiceId) {
        const { data: serverInv } = await supabase
          .from('invoices')
          .select('visual_recreation')
          .eq('id', routeInvoiceId)
          .single();

        if (serverInv && serverInv.visual_recreation) {
          const hasConflict = checkSaveConflict(activeDoc, serverInv.visual_recreation);
          if (hasConflict) {
            setSaveStatus('conflict');
            setErrorMsg(
              'Concurrency warning: This invoice was updated by another session. Review changes before overwriting.'
            );
            setIsSaving(false);
            return;
          }
        }
      }

      const visualRecreation: InvoiceStudioDocV2 = {
        ...activeDoc,
        version: 2,
        revision: activeDoc.revision + 1,
        properties,
        updatedAt: new Date().toISOString(),
      };

      if (routeInvoiceId) {
        // UPDATE EXISTING INVOICE
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            client_id: clientId,
            invoice_number: invoiceNumber || null,
            issue_date: issueDate,
            due_date: dueDate,
            currency,
            subtotal,
            tax_amount: totalTax,
            discount_amount: totalDiscount,
            total_amount: totalAmount,
            balance_due: totalAmount,
            cgst,
            sgst,
            template_style: properties.templateId,
            visual_recreation: visualRecreation,
          })
          .eq('id', routeInvoiceId);

        if (updateError) throw updateError;

        // Replace line items
        await supabase.from('invoice_items').delete().eq('invoice_id', routeInvoiceId);
        const formattedItems = items.map((it) => {
          const lineSub = it.quantity * it.rate - (it.discount || 0);
          const lineTax = lineSub * (it.tax_rate / 100);
          return {
            invoice_id: routeInvoiceId,
            description: it.description || 'Deliverable item',
            quantity: it.quantity,
            rate: it.rate,
            tax_rate: it.tax_rate,
            discount: it.discount || 0,
            tax_amount: lineTax,
            amount: lineSub,
            hsn_code: it.hsn_code || null,
          };
        });

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(formattedItems);
        if (itemsError) throw itemsError;

        setSaveStatus('saved');
        navigate(`/invoices/${routeInvoiceId}`);
      } else {
        // INSERT NEW INVOICE
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
            template_style: properties.templateId,
            visual_recreation: visualRecreation,
          })
          .select()
          .single();

        if (invError) throw invError;

        const formattedItems = items.map((it) => {
          const lineSub = it.quantity * it.rate - (it.discount || 0);
          const lineTax = lineSub * (it.tax_rate / 100);
          return {
            invoice_id: invData.id,
            description: it.description || 'Deliverable item',
            quantity: it.quantity,
            rate: it.rate,
            tax_rate: it.tax_rate,
            discount: it.discount || 0,
            tax_amount: lineTax,
            amount: lineSub,
            hsn_code: it.hsn_code || null,
          };
        });

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(formattedItems);
        if (itemsError) throw itemsError;

        setSaveStatus('saved');
        navigate(`/invoices/${invData.id}`);
      }
    } catch (err: any) {
      console.error('Failed to save invoice:', err);
      const msg = err.message || 'Failed to save invoice.';
      if (msg.includes('quota_exceeded')) {
        setQuotaError({
          message: msg.replace(/.*quota_exceeded:[^:]*:\s*/, ''),
          feature: 'invoices',
          upgradeUrl: '/pricing',
        });
      } else {
        setErrorMsg(msg);
      }
      setSaveStatus('dirty');
    } finally {
      setIsSaving(false);
    }
  };

  // Look up selected element
  const selectedElement = activeDoc.elements.find((el) => el.id === selectedElementId) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#07080B] text-zinc-100 font-sans">
      {/* ── TOP WORKSPACE TOOLBAR ── */}
      <InvoiceStudioToolbar
        invoiceNumber={invoiceNumber}
        onInvoiceNumberChange={(val) => {
          setInvoiceNumber(val);
          setSaveStatus('dirty');
        }}
        saveStatus={saveStatus}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitToPage={handleFitToPage}
        canUndo={checkCanUndo(history)}
        canRedo={checkCanRedo(history)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        previewMode={previewMode}
        onTogglePreviewMode={() => setPreviewMode(!previewMode)}
        onDownloadPDF={handleDownloadPDF}
        onDownloadPNG={handleDownloadPNG}
        onSaveInvoice={handleSaveInvoice}
        onCancel={() => navigate('/invoices')}
        isSaving={isSaving}
        isExistingInvoice={isExistingInvoice}
      />

      {/* ── QUOTA & CONFLICT NOTIFICATIONS ── */}
      {quotaError && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-300 px-6 z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
            <span className="font-bold">Monthly Invoice Limit Reached:</span>
            <span>{quotaError.message}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/pricing')}
              className="flex items-center gap-1 font-bold text-[#FF6B4A] hover:underline"
            >
              <span>Upgrade Plan</span>
              <ExternalLink size={12} />
            </button>
            <button
              onClick={() => setQuotaError(null)}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-red-500/15 border-b border-red-500/30 flex items-center justify-between text-xs text-red-300 px-6 z-30">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 3-COLUMN WORKSPACE BODY ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. LEFT SIDEBAR (Templates, Text, Shapes, Images, Elements) */}
        {!previewMode && (
          <InvoiceStudioLeftPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedTemplateId={properties.templateId}
            onSelectTemplate={handleSelectTemplate}
            properties={properties}
            onUpdateProperties={handleUpdateProperties}
            clients={clients}
            clientId={clientId}
            onClientChange={(id) => {
              setClientId(id);
              setSaveStatus('dirty');
            }}
            onOpenCreateClientModal={() => setIsClientModalOpen(true)}
            issueDate={issueDate}
            onIssueDateChange={(val) => {
              setIssueDate(val);
              setSaveStatus('dirty');
            }}
            dueDate={dueDate}
            onDueDateChange={(val) => {
              setDueDate(val);
              setSaveStatus('dirty');
            }}
            currency={currency}
            onCurrencyChange={(val) => {
              setCurrency(val);
              setSaveStatus('dirty');
            }}
            items={items}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
            onUpdateItem={handleUpdateItem}
            subtotal={subtotal}
            totalTax={totalTax}
            totalAmount={totalAmount}
            onAddCanvasElement={handleAddCanvasElement}
          />
        )}

        {/* 2. CENTRAL INTERACTIVE A4 PREVIEW STAGE */}
        <main
          ref={viewportContainerRef}
          className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex flex-col items-center justify-start bg-[#0B0C10] relative select-none scrollbar-thin"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.04) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Top Document Status Ribbon */}
          <div className="w-full max-w-[800px] mb-3 flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>A4 Interactive Studio Canvas (794 × 1123 px)</span>
            </span>
            <span className="text-zinc-500">
              Rev: <strong className="text-zinc-300">{activeDoc.revision}</strong> ·{' '}
              Layers: <strong className="text-zinc-300">{activeDoc.elements.length}</strong>
            </span>
          </div>

          {/* Notice banner when using sample client data */}
          {!clientId && (
            <div className="w-full max-w-[800px] mb-3 px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-200 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-amber-400 shrink-0" />
                <span>
                  {clients.length === 0
                    ? 'Previewing template with demo client details. Register a client account to issue official invoices.'
                    : 'Previewing with demo client details. Select or register a client before issuing.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(true)}
                className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[11px] transition-colors whitespace-nowrap ml-3"
              >
                + Register Client Account
              </button>
            </div>
          )}

          {/* Scalable Canvas Wrapper */}
          <div className="w-full flex justify-center items-start pb-16 overflow-visible">
            <div
              data-canvas-scale-wrapper="true"
              className="relative transition-all duration-100 ease-out flex-shrink-0"
              style={{
                width: `${Math.round(CANVAS_A4_WIDTH * effectiveScale)}px`,
                height: `${Math.round(CANVAS_A4_HEIGHT * effectiveScale)}px`,
                minWidth: `${Math.round(CANVAS_A4_WIDTH * effectiveScale)}px`,
                minHeight: `${Math.round(CANVAS_A4_HEIGHT * effectiveScale)}px`,
              }}
            >
              <div
                style={{
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                  width: `${CANVAS_A4_WIDTH}px`,
                  minHeight: `${CANVAS_A4_HEIGHT}px`,
                }}
              >
                {loadingInitial ? (
                  <div className="w-[794px] min-h-[600px] rounded-xl border border-divider bg-card-bg/60 flex flex-col items-center justify-center gap-3 text-muted">
                    <Loader2 className="animate-spin text-[#FF6B4A]" size={28} />
                    <span className="text-xs font-mono">Loading Invoice Studio Canvas...</span>
                  </div>
                ) : (
                  <StudioInteractiveCanvas
                    ref={canvasRef}
                    document={activeDoc}
                    properties={properties}
                    selectedElementId={selectedElementId}
                    onSelectElement={setSelectedElementId}
                    onUpdateElement={handleUpdateElement}
                    onDeleteElement={handleDeleteElement}
                    onDuplicateElement={handleDuplicateElement}
                    zoom={Math.round(effectiveScale * 100)}
                    previewMode={previewMode}
                    invoiceNumber={invoiceNumber}
                    issueDate={issueDate}
                    dueDate={dueDate}
                    currency={currency}
                    seller={seller}
                    client={activeClientData}
                    items={items}
                    subtotal={subtotal}
                    totalTax={totalTax}
                    totalDiscount={totalDiscount}
                    totalAmount={totalAmount}
                  />
                )}
              </div>
            </div>
          </div>
        </main>

        {/* 3. RIGHT SIDEBAR (Properties & Element Inspector) */}
        {!previewMode && (
          <InvoiceStudioRightPanel
            properties={properties}
            onUpdateProperties={handleUpdateProperties}
            selectedElement={selectedElement}
            onUpdateSelectedElement={(updates) => {
              if (selectedElementId) {
                handleUpdateElement(selectedElementId, updates, true);
              }
            }}
            onDuplicateSelectedElement={() => {
              if (selectedElementId) {
                handleDuplicateElement(selectedElementId);
              }
            }}
            onDeleteSelectedElement={() => {
              if (selectedElementId) {
                handleDeleteElement(selectedElementId);
              }
            }}
            onReorderElementLayer={handleReorderLayer}
          />
        )}
      </div>

      {/* ── QUICK REGISTER CLIENT MODAL ── */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12131A] border border-zinc-800 rounded-xl w-full max-w-md p-6 shadow-2xl relative text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#FF6B4A]" />
                <h3 className="font-bold text-sm">Register Client Account</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsClientModalOpen(false);
                  setClientSaveError(null);
                }}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase font-semibold mb-1">
                  Contact / Client Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase font-semibold mb-1">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Technologies Pvt Ltd"
                  value={newClientCompany}
                  onChange={(e) => setNewClientCompany(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="billing@acme.com"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase font-semibold mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase font-semibold mb-1">
                    GSTIN / Tax ID
                  </label>
                  <input
                    type="text"
                    placeholder="29ABCDE1234F1Z5"
                    value={newClientGst}
                    onChange={(e) => setNewClientGst(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 uppercase font-mono placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase font-semibold mb-1">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    placeholder="City, State, Country"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                  />
                </div>
              </div>

              {clientSaveError && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {clientSaveError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsClientModalOpen(false);
                    setClientSaveError(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClient || !newClientName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md"
                >
                  {isSubmittingClient ? 'Saving...' : 'Save & Select Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
