import { useState, useMemo } from 'react';
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
    if (isCreating) return;
    
    // Prevent scheduling in the past
    if (slotInfo.start < new Date()) {
      alert("Cannot schedule a meeting in the past.");
      return;
    }

    const title = prompt("Enter Meeting Title:", "Scheduled Meeting");
    if (!title) return;

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
      alert("Failed to schedule meeting.");
    } finally {
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
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        display: 'block'
      }
    };
  };

  return (
    <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 shadow-xl w-full h-[800px] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-base">Workspace Calendar</h3>
          <p className="text-xs text-gray-500 mt-0.5">Click any empty slot to schedule a new meeting</p>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="flex-1 calendar-container text-white min-h-0">
        <style>{`
          .rbc-calendar { font-family: inherit; }
          .rbc-month-view, .rbc-time-view { border-color: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; background: #1D1D29; }
          .rbc-header { border-bottom-color: rgba(255,255,255,0.05); padding: 12px 0; font-weight: 700; font-size: 13px; color: #999; }
          .rbc-month-row, .rbc-day-bg, .rbc-time-header-content { border-color: rgba(255,255,255,0.05); }
          .rbc-time-content { border-top-color: rgba(255,255,255,0.05); }
          .rbc-timeslot-group { border-bottom-color: rgba(255,255,255,0.05); }
          .rbc-time-slot { border-color: rgba(255,255,255,0.02); }
          .rbc-time-gutter .rbc-timeslot-group { border-color: rgba(255,255,255,0.05); }
          .rbc-label { color: #666; font-size: 11px; padding: 0 8px; }
          .rbc-today { background-color: rgba(255,107,74,0.02) !important; }
          .rbc-off-range-bg { background-color: rgba(255,255,255,0.01); }
          .rbc-event { transition: transform 0.2s, filter 0.2s; }
          .rbc-event:hover { transform: scale(1.02); filter: brightness(1.2); }
          .rbc-toolbar button { color: #999; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 12px; font-weight: 600; background: transparent; transition: all 0.2s; }
          .rbc-toolbar button:hover { background: rgba(255,255,255,0.05); color: #fff; }
          .rbc-toolbar button.rbc-active { background: #FF6B4A; border-color: #FF6B4A; color: #fff; }
          .rbc-current-time-indicator { background-color: #FF6B4A; height: 2px; z-index: 5; }
          .rbc-current-time-indicator::before { content: ''; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #FF6B4A; }
          
          /* Custom slot selection styling */
          .rbc-slot-selection { background-color: rgba(255,107,74,0.2) !important; }
        `}</style>
        
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.WEEK}
          views={['month', 'week', 'day']}
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
