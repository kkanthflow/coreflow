import { useState, useMemo, useRef } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import type { SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

// Initialize the localizer for react-big-calendar
const locales = {
  'en-US': enUS,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Meeting {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  duration: number | null;
}

interface CalendarViewProps {
  meetings: Meeting[];
  onJoin: (id: string) => void;
}

// Custom Event Component for the Calendar
function CustomEvent({ event }: any) {
  const isLive = event.resource.status === 'active' || event.resource.status === 'joined';
  
  return (
    <div className="flex items-center gap-1.5 h-full w-full overflow-hidden px-1">
      {isLive && (
        <span className="flex h-2 w-2 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B4A] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF6B4A]"></span>
        </span>
      )}
      {!isLive && <Video size={12} className="shrink-0 opacity-50" />}
      <span className="text-xs font-semibold truncate leading-tight">
        {event.title}
      </span>
    </div>
  );
}

export function CalendarView({ meetings, onJoin }: CalendarViewProps) {
  const { session } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Map meetings to react-big-calendar event format
  const events = useMemo(() => {
    return meetings.map(m => ({
      id: m.id,
      title: m.title,
      start: new Date(m.start_time),
      end: m.end_time ? new Date(m.end_time) : new Date(new Date(m.start_time).getTime() + (m.duration || 60) * 60000),
      resource: m
    }));
  }, [meetings]);

  const handleSelectEvent = (event: any) => {
    onJoin(event.id);
  };

  const handleSelectSlot = async (slotInfo: SlotInfo) => {
    // Basic slot scheduling: Create a meeting directly in the slot
    if (!session?.user?.id) return;
    if (isCreatingRef.current) return;
    
    // Prevent scheduling in the past
    if (slotInfo.start < new Date()) {
      setErrorMsg("Cannot schedule a meeting in the past.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const title = prompt("Enter Meeting Title:", "Scheduled Meeting");
    if (!title) return;

    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const duration = Math.round((slotInfo.end.getTime() - slotInfo.start.getTime()) / 60000);
      
      await supabase.from('meetings').insert([{
        title,
        description: 'Scheduled via Calendar',
        status: 'scheduled',
        start_time: slotInfo.start.toISOString(),
        end_time: slotInfo.end.toISOString(),
        host_id: session.user.id,
        duration: duration > 0 ? duration : 60
      }]);
      // The Realtime subscription in Dashboard will pick this up automatically
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to schedule meeting.");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  };

  const eventPropGetter = (event: any) => {
    const isLive = event.resource.status === 'active' || event.resource.status === 'joined';
    const isPast = new Date(event.end) < new Date() || event.resource.status === 'completed';

    let backgroundColor = 'rgba(255, 255, 255, 0.05)';
    let borderColor = 'rgba(255, 255, 255, 0.1)';
    let color = '#fff';

    if (isLive) {
      backgroundColor = 'rgba(255, 107, 74, 0.1)';
      borderColor = 'rgba(255, 107, 74, 0.4)';
      color = '#FF6B4A';
    } else if (isPast) {
      backgroundColor = 'rgba(255, 255, 255, 0.02)';
      color = 'rgba(255, 255, 255, 0.4)';
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        color,
        backdropFilter: 'blur(8px)',
        boxShadow: isLive ? '0 0 20px rgba(255, 107, 74, 0.1)' : 'none',
        borderRadius: '10px',
        borderWidth: '1px',
        borderStyle: 'solid',
        display: 'block',
        padding: '2px 4px',
      }
    };
  };

  return (
    <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 shadow-xl w-full h-[800px] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
      
      {/* Beautiful Error Banner */}
      {errorMsg && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-8 fade-in duration-300">
          <div className="bg-red-500/10 border border-red-500/50 backdrop-blur-md text-red-500 px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="font-medium text-sm">{errorMsg}</span>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between z-10">
        <div>
          <h3 className="font-bold text-white text-base">Workspace Calendar</h3>
          <p className="text-xs text-gray-500 mt-0.5">Click any empty slot to schedule a new meeting</p>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="flex-1 calendar-container text-white min-h-0">
        <style>{`
          .rbc-calendar { font-family: inherit; }
          
          /* Remove harsh borders and unify background */
          .rbc-month-view, .rbc-time-view { 
            border: none !important; 
            background: transparent; 
          }
          
          /* Elegant Headers */
          .rbc-header { 
            border-bottom: 1px solid rgba(255,255,255,0.05) !important; 
            padding: 12px 0; 
            font-weight: 500; 
            font-size: 13px; 
            color: #9CA3AF; 
          }
          .rbc-header + .rbc-header {
            border-left: 1px solid rgba(255,255,255,0.02) !important;
          }
          
          /* Subtle Grid Lines */
          .rbc-month-row, .rbc-day-bg, .rbc-time-header-content { border-color: rgba(255,255,255,0.03) !important; }
          .rbc-time-content { border-top: 1px solid rgba(255,255,255,0.03) !important; }
          .rbc-timeslot-group { border-bottom: 1px solid rgba(255,255,255,0.03) !important; min-height: 52px; }
          .rbc-time-slot { border: none !important; } /* Remove dashed half-hour lines for cleaner look */
          .rbc-time-gutter .rbc-timeslot-group { border-color: transparent !important; }
          
          /* Time Gutter Labels */
          .rbc-label { color: #6B7280; font-size: 11px; padding: 0 16px 0 8px; font-weight: 500; }
          
          /* Today Highlight */
          .rbc-today { background-color: rgba(255,255,255,0.02) !important; }
          .rbc-off-range-bg { background-color: transparent; }
          
          /* Event Aesthetics */
          .rbc-event { 
            transition: all 0.2s ease; 
            border-radius: 8px !important; 
          }
          .rbc-event:hover { 
            transform: translateY(-1px); 
            filter: brightness(1.1); 
            z-index: 10 !important; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.4); 
          }
          .rbc-day-slot .rbc-events-container { margin-right: 8px; }
          
          /* Toolbar */
          .rbc-toolbar { margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
          .rbc-toolbar-label { font-size: 18px; font-weight: 600; color: #fff; letter-spacing: -0.01em; }
          
          /* Professional Segmented Controls */
          .rbc-btn-group {
            display: inline-flex;
            background: rgba(255,255,255,0.03);
            border-radius: 10px;
            padding: 4px;
            border: 1px solid rgba(255,255,255,0.05);
          }
          .rbc-toolbar button { 
            color: #9CA3AF; 
            border: none !important; 
            border-radius: 8px !important; 
            padding: 8px 16px !important; 
            font-size: 13px;
            font-weight: 500; 
            background: transparent; 
            transition: all 0.2s ease; 
            margin: 0 !important;
          }
          .rbc-toolbar button:hover { 
            color: #fff; 
          }
          .rbc-toolbar button.rbc-active { 
            background: rgba(255, 107, 74, 0.1); 
            color: #FF6B4A; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
          }
          
          /* Current time line */
          .rbc-current-time-indicator { 
            background-color: #FF6B4A; 
            height: 2px; 
            z-index: 5; 
            box-shadow: 0 0 8px rgba(255,107,74,0.3);
          }
          .rbc-current-time-indicator::before { 
            content: ''; 
            position: absolute; 
            left: -5px; 
            top: -4px; 
            width: 10px; 
            height: 10px; 
            border-radius: 50%; 
            background: #FF6B4A; 
          }
          
          /* Custom slot selection styling */
          .rbc-slot-selection { background-color: rgba(255,107,74,0.1) !important; }
          
          /* Custom Scrollbar for Calendar */
          .calendar-container ::-webkit-scrollbar { width: 6px; height: 6px; }
          .calendar-container ::-webkit-scrollbar-track { background: transparent; }
          .calendar-container ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .calendar-container ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        `}</style>
        
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.WEEK}
          views={['month', 'week', 'day']}
          dayLayoutAlgorithm="no-overlap"
          selectable={true}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          components={{
            event: CustomEvent
          }}
          step={30}
          timeslots={2}
          min={new Date(0, 0, 0, 7, 0, 0)} // Start day at 7 AM
          max={new Date(0, 0, 0, 22, 0, 0)} // End day at 10 PM
        />
      </div>
      
      {isCreating && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
          <div className="bg-[#1D1D29] p-6 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
            <span className="font-bold">Scheduling meeting...</span>
          </div>
        </div>
      )}
    </div>
  );
}
