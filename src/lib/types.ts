export interface Task {
  id: string;
  name: string;
  group_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  color: string;
  progress: number;   // 0-100
  dependencies: string[];
  notes: string;
}

export interface Milestone {
  id: string;
  name: string;
  group_id: string;
  date: string; // YYYY-MM-DD
  color: string;
  dependencies: string[];
}

export interface Group {
  id: string;
  name: string;
  order: number;
  color: string;
}

export interface ViewSettings {
  zoom: 'day' | 'week' | 'month';
  scroll_date: string;
  collapsed_groups: string[];
}

export interface ProjectData {
  schema_version: string;
  project: {
    name: string;
    created: string;
    modified: string;
  };
  view_settings: ViewSettings;
  groups: Group[];
  tasks: Task[];
  milestones: Milestone[];
}

export type ViewMode = 'day' | 'week' | 'month';

export interface HitRegion {
  type: 'bar-body' | 'bar-left-edge' | 'bar-right-edge' | 'milestone' | 'group-row';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DragState {
  type: 'move' | 'resize-left' | 'resize-right' | 'move-milestone';
  id: string;
  startX: number;
  originalStartDate: string;
  originalEndDate: string;
}

export interface RowLayout {
  id: string;
  type: 'group' | 'task' | 'milestone';
  y: number;
  groupId?: string;
}
