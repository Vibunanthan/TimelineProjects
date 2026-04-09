import { create } from 'zustand';
import type { Task, Milestone, Group, ProjectData, ViewMode } from './types';
import { generateId, todayStr } from './date-utils';
import { bridge } from './pywebview-bridge';

interface ProjectStore {
  // Project data
  project: ProjectData | null;
  filePath: string | null;
  isDirty: boolean;

  // UI state
  selectedId: string | null;
  selectedType: 'task' | 'milestone' | 'group' | null;
  editPanelOpen: boolean;
  viewMode: ViewMode;
  pixelsPerDay: number;
  scrollX: number;
  scrollY: number;
  collapsedGroups: Set<string>;

  // Undo/redo
  undoStack: ProjectData[];
  redoStack: ProjectData[];

  // Actions
  newProject: (name: string) => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  loadProjectData: (data: ProjectData, path?: string) => void;

  // Selection
  select: (id: string | null, type: 'task' | 'milestone' | 'group' | null) => void;
  closeEditPanel: () => void;

  // Mutations (with undo support)
  addGroup: (name: string) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  toggleGroupCollapse: (id: string) => void;

  addTask: (groupId: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  addMilestone: (groupId: string) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;

  // View
  setViewMode: (mode: ViewMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setScrollX: (x: number) => void;
  setScrollY: (y: number) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function cloneProject(p: ProjectData): ProjectData {
  return JSON.parse(JSON.stringify(p));
}

const ZOOM_LEVELS: Record<ViewMode, number> = {
  day: 40,
  week: 18,
  month: 5,
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  filePath: null,
  isDirty: false,
  selectedId: null,
  selectedType: null,
  editPanelOpen: false,
  viewMode: 'week',
  pixelsPerDay: ZOOM_LEVELS.week,
  scrollX: 0,
  scrollY: 0,
  collapsedGroups: new Set(),
  undoStack: [],
  redoStack: [],

  newProject: async (name: string) => {
    const data = await bridge.newProject(name);
    set({
      project: data,
      filePath: null,
      isDirty: false,
      selectedId: null,
      selectedType: null,
      editPanelOpen: false,
      undoStack: [],
      redoStack: [],
      collapsedGroups: new Set(),
      scrollX: 0,
      scrollY: 0,
    });
  },

  openProject: async () => {
    const result = await bridge.openProject();
    if (result.cancelled || result.error) return;
    set({
      project: result.data,
      filePath: result.path || null,
      isDirty: false,
      selectedId: null,
      selectedType: null,
      editPanelOpen: false,
      undoStack: [],
      redoStack: [],
      collapsedGroups: new Set(result.data?.view_settings?.collapsed_groups || []),
      scrollX: 0,
      scrollY: 0,
    });
  },

  saveProject: async () => {
    const { project, filePath } = get();
    if (!project) return;
    if (!filePath) {
      get().saveProjectAs();
      return;
    }
    const data = { ...project, project: { ...project.project, modified: new Date().toISOString() } };
    await bridge.saveProject(data, filePath);
    set({ isDirty: false, project: data });
  },

  saveProjectAs: async () => {
    const { project } = get();
    if (!project) return;
    const data = { ...project, project: { ...project.project, modified: new Date().toISOString() } };
    const result = await bridge.saveProjectAs(data);
    if (result.cancelled || result.error) return;
    set({ filePath: result.path || null, isDirty: false, project: data });
  },

  loadProjectData: (data: ProjectData, path?: string) => {
    set({
      project: data,
      filePath: path || null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      collapsedGroups: new Set(data.view_settings?.collapsed_groups || []),
    });
  },

  select: (id, type) => {
    set({ selectedId: id, selectedType: type, editPanelOpen: id !== null });
  },

  closeEditPanel: () => {
    set({ editPanelOpen: false, selectedId: null, selectedType: null });
  },

  // Helper: push to undo before mutation
  addGroup: (name: string) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    const newGroup: Group = {
      id: generateId(),
      name,
      order: project.groups.length,
      color: ['#4A90D9', '#50C878', '#E67E22', '#9B59B6', '#E74C3C'][project.groups.length % 5],
    };
    set({
      project: { ...project, groups: [...project.groups, newGroup] },
      isDirty: true,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  updateGroup: (id, updates) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    set({
      project: {
        ...project,
        groups: project.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      },
      isDirty: true,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  deleteGroup: (id) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    set({
      project: {
        ...project,
        groups: project.groups.filter((g) => g.id !== id),
        tasks: project.tasks.filter((t) => t.group_id !== id),
        milestones: project.milestones.filter((m) => m.group_id !== id),
      },
      isDirty: true,
      selectedId: null,
      selectedType: null,
      editPanelOpen: false,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  toggleGroupCollapse: (id) => {
    set((state) => {
      const next = new Set(state.collapsedGroups);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedGroups: next };
    });
  },

  addTask: (groupId: string) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    const group = project.groups.find((g) => g.id === groupId);
    const today = todayStr();
    const newTask: Task = {
      id: generateId(),
      name: 'New Task',
      group_id: groupId,
      start_date: today,
      end_date: todayStr(), // Will be set by adding 7 days
      color: group?.color || '#4A90D9',
      progress: 0,
      dependencies: [],
      notes: '',
    };
    // Set end date to 7 days from today
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    newTask.end_date = end.toISOString().split('T')[0];

    set({
      project: { ...project, tasks: [...project.tasks, newTask] },
      isDirty: true,
      selectedId: newTask.id,
      selectedType: 'task',
      editPanelOpen: true,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  updateTask: (id, updates) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    set({
      project: {
        ...project,
        tasks: project.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      },
      isDirty: true,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  deleteTask: (id) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    // Also remove this task from any dependency lists
    set({
      project: {
        ...project,
        tasks: project.tasks
          .filter((t) => t.id !== id)
          .map((t) => ({
            ...t,
            dependencies: t.dependencies.filter((d) => d !== id),
          })),
        milestones: project.milestones.map((m) => ({
          ...m,
          dependencies: m.dependencies.filter((d) => d !== id),
        })),
      },
      isDirty: true,
      selectedId: null,
      selectedType: null,
      editPanelOpen: false,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  addMilestone: (groupId: string) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    const newMs: Milestone = {
      id: generateId(),
      name: 'New Milestone',
      group_id: groupId,
      date: todayStr(),
      color: '#E74C3C',
      dependencies: [],
    };
    set({
      project: { ...project, milestones: [...project.milestones, newMs] },
      isDirty: true,
      selectedId: newMs.id,
      selectedType: 'milestone',
      editPanelOpen: true,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  updateMilestone: (id, updates) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    set({
      project: {
        ...project,
        milestones: project.milestones.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      },
      isDirty: true,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  deleteMilestone: (id) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    set({
      project: {
        ...project,
        milestones: project.milestones.filter((m) => m.id !== id),
        tasks: project.tasks.map((t) => ({
          ...t,
          dependencies: t.dependencies.filter((d) => d !== id),
        })),
      },
      isDirty: true,
      selectedId: null,
      selectedType: null,
      editPanelOpen: false,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode, pixelsPerDay: ZOOM_LEVELS[mode] });
  },

  zoomIn: () => {
    set((state) => ({ pixelsPerDay: Math.min(state.pixelsPerDay * 1.3, 60) }));
  },

  zoomOut: () => {
    set((state) => ({ pixelsPerDay: Math.max(state.pixelsPerDay / 1.3, 3) }));
  },

  setScrollX: (x) => set({ scrollX: x }),
  setScrollY: (y) => set({ scrollY: y }),

  undo: () => {
    const { undoStack, project } = get();
    if (undoStack.length === 0 || !project) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      project: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, cloneProject(project)],
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, project } = get();
    if (redoStack.length === 0 || !project) return;
    const next = redoStack[redoStack.length - 1];
    set({
      project: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, cloneProject(project!)],
      isDirty: true,
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}));
