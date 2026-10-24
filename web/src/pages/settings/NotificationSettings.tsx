import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldAlert, 
  Calendar, 
  CheckSquare, 
  FileText, 
  MessageSquare, 
  AtSign,
  Moon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../contexts/SettingsContext';
import type { NotificationSettings as INotificationSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
import {
  SettingsSection,
  SettingsRow,
  Toggle,
  Select,
} from '../../components/settings';

const REMINDER_MINUTES_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
];

export default function NotificationSettings() {
  const { user } = useAuth();
  const { userSettings, updateUserSetting } = useSettings();

  const notifications = userSettings.notifications || {
    push: false,
    emailDigest: true,
    inApp: true,
    meetingReminders: true,
    meetingReminderMinutes: 15,
    taskDue: true,
    approvals: true,
    invoicePaid: true,
    mentions: true,
    chat: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  };

  // Browser Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Desktop notifications are not supported in this browser environment');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        handleToggleNotification('push', true);
        toast.success('Desktop notification permission granted');
      } else if (perm === 'denied') {
        handleToggleNotification('push', false);
        toast.error('Notification permission was blocked in browser settings');
      }
    } catch (err: any) {
      toast.error('Permission request failed: ' + err.message);
    }
  };

  const handleToggleNotification = (key: keyof INotificationSettings, val: any) => {
    const next = { ...notifications, [key]: val };
    updateUserSetting('notifications', next, true);
  };

  // Resend Test Email State
  const [testEmailAddress, setTestEmailAddress] = useState(user?.email || '');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; deliveryId?: string } | null>(null);

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const apiUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : '';
      const res = await fetch(`${apiUrl}/api/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ recipient: testEmailAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to send test email');
      }
      setTestEmailResult({ success: true, message: data.message, deliveryId: data.deliveryId });
      toast.success('Test email sent via Resend successfully!');
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message });
      toast.error(err.message || 'Error dispatching test email');
    } finally {
      setTestEmailSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Delivery Channels ── */}
      <SettingsSection
        label="Notification Channels"
        description="Choose how urgent updates, mentions, and scheduled reminders reach you."
      >
        {/* Push Notification */}
        <SettingsRow
          icon={Bell}
          title="Browser Push Notifications"
          description={`System banner alerts when app is minimized or backgrounded. Status: ${notificationPermission.toUpperCase()}.`}
        >
          {notificationPermission !== 'granted' ? (
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Enable Notifications
            </button>
          ) : (
            <Toggle
              checked={notifications.push}
              onChange={(checked) => handleToggleNotification('push', checked)}
              ariaLabel="Toggle push notifications"
            />
          )}
        </SettingsRow>

        {/* Email Digest */}
        <SettingsRow
          icon={Mail}
          title="Email Digest & Summaries"
          description="Receive a consolidated breakdown of workspace tasks and outstanding approvals."
        >
          <Toggle
            checked={notifications.emailDigest}
            onChange={(checked) => handleToggleNotification('emailDigest', checked)}
            ariaLabel="Toggle email digests"
          />
        </SettingsRow>

        {/* In-App Alerts */}
        <SettingsRow
          icon={ShieldAlert}
          title="In-App Toast Banners"
          description="Floating real-time toasts and notification badge counters within the workspace."
        >
          <Toggle
            checked={notifications.inApp}
            onChange={(checked) => handleToggleNotification('inApp', checked)}
            ariaLabel="Toggle in-app banners"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Event Triggers ── */}
      <SettingsSection
        label="Notification Triggers"
        description="Select which events generate operational notifications."
      >
        {/* Meeting Reminders */}
        <SettingsRow
          icon={Calendar}
          title="Meeting Reminders"
          description="Proactive alert before scheduled team video calls and client syncs."
        >
          <div className="flex items-center gap-3">
            {notifications.meetingReminders && (
              <Select
                value={notifications.meetingReminderMinutes || 15}
                onChange={(e) => handleToggleNotification('meetingReminderMinutes', Number(e.target.value))}
                options={REMINDER_MINUTES_OPTIONS}
                size="sm"
              />
            )}
            <Toggle
              checked={notifications.meetingReminders}
              onChange={(checked) => handleToggleNotification('meetingReminders', checked)}
              ariaLabel="Toggle meeting reminders"
            />
          </div>
        </SettingsRow>

        {/* Tasks Assigned / Due */}
        <SettingsRow
          icon={CheckSquare}
          title="Task Assignments & Deadlines"
          description="When tasks are assigned to you or approach their target completion date."
        >
          <Toggle
            checked={notifications.taskDue}
            onChange={(checked) => handleToggleNotification('taskDue', checked)}
            ariaLabel="Toggle task notifications"
          />
        </SettingsRow>

        {/* Approvals */}
        <SettingsRow
          icon={Clock}
          title="Workflow Approvals"
          description="When a financial invoice or operational change requires your signature."
        >
          <Toggle
            checked={notifications.approvals}
            onChange={(checked) => handleToggleNotification('approvals', checked)}
            ariaLabel="Toggle approval notifications"
          />
        </SettingsRow>

        {/* Invoices */}
        <SettingsRow
          icon={FileText}
          title="Invoice Payments & Settlement"
          description="Instant notification when client payments are confirmed or overdue."
        >
          <Toggle
            checked={notifications.invoicePaid}
            onChange={(checked) => handleToggleNotification('invoicePaid', checked)}
            ariaLabel="Toggle invoice notifications"
          />
        </SettingsRow>

        {/* Mentions */}
        <SettingsRow
          icon={AtSign}
          title="Direct Mentions (@you)"
          description="When another team member tags you in project discussions or task notes."
        >
          <Toggle
            checked={notifications.mentions}
            onChange={(checked) => handleToggleNotification('mentions', checked)}
            ariaLabel="Toggle mention notifications"
          />
        </SettingsRow>

        {/* Direct Messages */}
        <SettingsRow
          icon={MessageSquare}
          title="Team & Direct Chat"
          description="New inbound 1:1 messages or channel posts."
        >
          <Toggle
            checked={notifications.chat}
            onChange={(checked) => handleToggleNotification('chat', checked)}
            ariaLabel="Toggle chat notifications"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Quiet Hours ── */}
      <SettingsSection
        label="Quiet Hours & Do Not Disturb"
        description="Mute non-critical sound effects and push notifications during defined rest periods."
      >
        <SettingsRow
          icon={Moon}
          title="Enable Quiet Hours"
          description="Automatically silence alerts during specified time window."
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {notifications.quietHoursEnabled && (
              <div className="flex items-center gap-1.5 font-mono text-xs text-text">
                <input
                  type="time"
                  value={notifications.quietHoursStart || '22:00'}
                  onChange={(e) => handleToggleNotification('quietHoursStart', e.target.value)}
                  className="px-2 py-1 rounded-lg bg-surface-2 border border-line text-xs font-mono focus:outline-none focus:border-accent"
                />
                <span className="text-muted">to</span>
                <input
                  type="time"
                  value={notifications.quietHoursEnd || '08:00'}
                  onChange={(e) => handleToggleNotification('quietHoursEnd', e.target.value)}
                  className="px-2 py-1 rounded-lg bg-surface-2 border border-line text-xs font-mono focus:outline-none focus:border-accent"
                />
              </div>
            )}
            <Toggle
              checked={notifications.quietHoursEnabled}
              onChange={(checked) => handleToggleNotification('quietHoursEnabled', checked)}
              ariaLabel="Toggle quiet hours"
            />
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* ── Resend Diagnostic Email Workflow ── */}
      <SettingsSection
        label="Email Service Diagnostics"
        description="Verify runtime outbound transactional email delivery via the Resend API."
      >
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 px-3.5 py-2 rounded-xl bg-surface-2 border border-line text-xs text-text placeholder-muted focus:outline-none focus:border-accent font-mono"
            />
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testEmailSending}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold text-[11px] transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw size={12} className={testEmailSending ? 'animate-spin' : ''} />
              <span>{testEmailSending ? 'Dispatching...' : 'Send Test Email'}</span>
            </button>
          </div>

          {testEmailResult && (
            <div
              className={`p-3.5 rounded-xl text-xs font-mono border transition-colors ${
                testEmailResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 mb-0.5">
                {testEmailResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{testEmailResult.success ? 'Resend Delivery Verified' : 'Delivery Error'}</span>
              </div>
              <div>{testEmailResult.message}</div>
              {testEmailResult.deliveryId && (
                <div className="text-[10px] text-muted mt-1">
                  Delivery ID: {testEmailResult.deliveryId}
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
