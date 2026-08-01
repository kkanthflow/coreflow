export type MeetingStatus = 'Draft' | 'Scheduled' | 'Live' | 'Completed' | 'Cancelled' | 'Archived';

export interface MeetingParticipant {
  id: string;
  user_id: string;
  role: 'host' | 'participant';
  status: 'invited' | 'accepted' | 'declined';
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: MeetingStatus;
  host_id: string;
  workspace_id?: string;
  project_id?: string;
  team_id?: string;
  room_name?: string;
  meeting_link_type?: string;
  meeting_link?: string;
  location?: string;
  recurrence_rule?: string;
  participants?: MeetingParticipant[];
}
