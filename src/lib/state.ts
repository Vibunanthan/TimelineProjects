import { create } from 'zustand';
import type { Task, Milestone, Group, ProjectData, ViewMode } from './types';
import { generateId, todayStr, daysBetween, addDaysToDate } from './date-utils';
import { bridge } from './pywebview-bridge';

/**
 * Propagate date changes through starts_after links.
 * When a task/milestone's end date changes, all tasks that have
 * starts_after pointing to it get their start_date set to the new
 * end date, preserving their duration. This cascades recursively.
 */
function propagateStartAfterLinks(tasks: Task[], changedId: string, newEndDate: string): Task[] {
  const queue = [{ id: changedId, endDate: newEndDate }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, endDate } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.starts_after === id) {
        const duration = daysBetween(t.start_date, t.end_date);
        const newStart = endDate;
        const newEnd = addDaysToDate(newStart, duration);
        tasks = tasks.map((task) =>
          task.id === t.id ? { ...task, start_date: newStart, end_date: newEnd } : task
        );
        // Cascade: this task's end changed too, propagate to its dependents
        queue.push({ id: t.id, endDate: newEnd });
      }
    }
  }

  return tasks;
}

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

  addTask: (groupId: string, options?: { name?: string; start_date?: string; end_date?: string; dependencies?: string[]; starts_after?: string }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  addMilestone: (groupId: string) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;

  applyGroupColorToItems: (groupId: string) => void;

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

  applyGroupColorToItems: (groupId: string) => {
    const { project } = get();
    if (!project) return;
    const group = project.groups.find((g) => g.id === groupId);
    if (!group) return;
    const prev = cloneProject(project);
    set({
      project: {
        ...project,
        tasks: project.tasks.map((t) =>
          t.group_id === groupId ? { ...t, color: group.color } : t
        ),
        milestones: project.milestones.map((m) =>
          m.group_id === groupId ? { ...m, color: group.color } : m
        ),
      },
      isDirty: true,
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

  addTask: (groupId: string, options?: { name?: string; start_date?: string; end_date?: string; dependencies?: string[]; starts_after?: string }) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    const group = project.groups.find((g) => g.id === groupId);

    const startDate = options?.start_date || todayStr();
    let endDate = options?.end_date;
    if (!endDate) {
      const s = new Date(startDate + 'T00:00:00');
      const e = new Date(s);
      e.setDate(e.getDate() + 7);
      endDate = e.toISOString().split('T')[0];
    }

    const newTask: Task = {
      id: generateId(),
      name: options?.name || 'New Task',
      group_id: groupId,
      start_date: startDate,
      end_date: endDate,
      color: group?.color || '#4A90D9',
      progress: 0,
      dependencies: options?.dependencies || [],
      starts_after: options?.starts_after,
      notes: '',
      completed: false,
    };

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

    let tasks = project.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));

    // If end_date changed, propagate to tasks linked via starts_after
    const updatedTask = tasks.find((t) => t.id === id);
    if (updatedTask && updates.end_date) {
      tasks = propagateStartAfterLinks(tasks, id, updatedTask.end_date);
    }
    // If the whole task was moved (start + end changed), also propagate
    if (updatedTask && updates.start_date && updates.end_date) {
      tasks = propagateStartAfterLinks(tasks, id, updatedTask.end_date);
    }

    set({
      project: { ...project, tasks },
      isDirty: true,
      undoStack: [...get().undoStack.slice(-49), prev],
      redoStack: [],
    });
  },

  deleteTask: (id) => {
    const { project } = get();
    if (!project) return;
    const prev = cloneProject(project);
    // Also remove this task from any dependency lists and starts_after links
    set({
      project: {
        ...project,
        tasks: project.tasks
          .filter((t) => t.id !== id)
          .map((t) => ({
            ...t,
            dependencies: t.dependencies.filter((d) => d !== id),
            starts_after: t.starts_after === id ? undefined : t.starts_after,
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

    const milestones = project.milestones.map((m) => (m.id === id ? { ...m, ...updates } : m));

    // If milestone date changed, propagate to tasks linked via starts_after
    let tasks = project.tasks;
    if (updates.date) {
      const updatedMs = milestones.find((m) => m.id === id);
      if (updatedMs) {
        tasks = propagateStartAfterLinks(tasks, id, updatedMs.date);
      }
    }

    set({
      project: { ...project, milestones, tasks },
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
          starts_after: t.starts_after === id ? undefined : t.starts_after,
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
