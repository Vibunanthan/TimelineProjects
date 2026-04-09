import type { HitRegion, DragState } from '@/lib/types';
import { addDays } from 'date-fns';
import { parseDate, formatDate } from '@/lib/date-utils';

const CLICK_THRESHOLD = 4;

export interface InteractionCallbacks {
  onSelect: (id: string, type: 'task' | 'milestone' | 'group') => void;
  onTaskUpdate: (id: string, updates: { start_date?: string; end_date?: string }) => void;
  onMilestoneUpdate: (id: string, updates: { date?: string }) => void;
  onGroupToggle: (id: string) => void;
  onRequestRender: () => void;
  getPixelsPerDay: () => number;
  getTimelineStartDate: () => Date;
  getTaskDates: (id: string) => { start_date: string; end_date: string } | null;
  getMilestoneDate: (id: string) => string | null;
}

export class GanttInteractionHandler {
  private dragState: DragState | null = null;
  private hitRegions: HitRegion[] = [];
  private callbacks: InteractionCallbacks;
  private canvas: HTMLCanvasElement;
  private totalMouseMove = 0;
  private mouseDownPos = { x: 0, y: 0 };

  // Preview state during drag
  previewDates: { id: string; start_date?: string; end_date?: string; date?: string } | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: InteractionCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
  }

  updateHitRegions(regions: HitRegion[]) {
    this.hitRegions = regions;
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
  }

  private hitTest(x: number, y: number): HitRegion | null {
    // Check edges first (higher priority), then bodies
    for (const region of this.hitRegions) {
      if (region.type !== 'bar-left-edge' && region.type !== 'bar-right-edge') continue;
      if (x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h) {
        return region;
      }
    }
    for (const region of this.hitRegions) {
      if (region.type === 'bar-left-edge' || region.type === 'bar-right-edge') continue;
      if (x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h) {
        return region;
      }
    }
    return null;
  }

  private onMouseDown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    this.totalMouseMove = 0;

    const hit = this.hitTest(x, y);
    if (!hit) {
      this.callbacks.onSelect('', 'task');
      return;
    }

    if (hit.type === 'group-row') {
      return; // handled on mouseup as click
    }

    // Resolve original dates synchronously so mousemove never runs with empty dates
    let originalStart = '';
    let originalEnd = '';

    if (hit.type === 'milestone') {
      const msDate = this.callbacks.getMilestoneDate(hit.id);
      if (msDate) {
        originalStart = msDate;
        originalEnd = msDate;
      }
    } else {
      const taskDates = this.callbacks.getTaskDates(hit.id);
      if (taskDates) {
        originalStart = taskDates.start_date;
        originalEnd = taskDates.end_date;
      }
    }

    if (!originalStart) return; // safety: don't start drag without dates

    if (hit.type === 'bar-left-edge') {
      this.dragState = { type: 'resize-left', id: hit.id, startX: e.clientX, originalStartDate: originalStart, originalEndDate: originalEnd };
    } else if (hit.type === 'bar-right-edge') {
      this.dragState = { type: 'resize-right', id: hit.id, startX: e.clientX, originalStartDate: originalStart, originalEndDate: originalEnd };
    } else if (hit.type === 'bar-body') {
      this.dragState = { type: 'move', id: hit.id, startX: e.clientX, originalStartDate: originalStart, originalEndDate: originalEnd };
    } else if (hit.type === 'milestone') {
      this.dragState = { type: 'move-milestone', id: hit.id, startX: e.clientX, originalStartDate: originalStart, originalEndDate: originalEnd };
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.totalMouseMove += Math.abs(e.clientX - this.mouseDownPos.x) + Math.abs(e.clientY - this.mouseDownPos.y);

    if (this.dragState) {
      const pixelsPerDay = this.callbacks.getPixelsPerDay();
      const deltaX = e.clientX - this.dragState.startX;
      const deltaDays = Math.round(deltaX / pixelsPerDay);

      const { type, id, originalStartDate, originalEndDate } = this.dragState;

      if (type === 'move') {
        const newStart = formatDate(addDays(parseDate(originalStartDate), deltaDays));
        const newEnd = formatDate(addDays(parseDate(originalEndDate), deltaDays));
        this.previewDates = { id, start_date: newStart, end_date: newEnd };
      } else if (type === 'resize-left') {
        const newStart = formatDate(addDays(parseDate(originalStartDate), deltaDays));
        if (newStart < originalEndDate) {
          this.previewDates = { id, start_date: newStart };
        }
      } else if (type === 'resize-right') {
        const newEnd = formatDate(addDays(parseDate(originalEndDate), deltaDays));
        if (newEnd > originalStartDate) {
          this.previewDates = { id, end_date: newEnd };
        }
      } else if (type === 'move-milestone') {
        const newDate = formatDate(addDays(parseDate(originalStartDate), deltaDays));
        this.previewDates = { id, date: newDate };
      }

      this.callbacks.onRequestRender();
      this.canvas.style.cursor = type.startsWith('resize') ? 'ew-resize' : 'grabbing';
      return;
    }

    // Hover cursor
    const hit = this.hitTest(x, y);
    if (hit) {
      if (hit.type === 'bar-left-edge' || hit.type === 'bar-right-edge') {
        this.canvas.style.cursor = 'ew-resize';
      } else if (hit.type === 'bar-body') {
        this.canvas.style.cursor = 'grab';
      } else if (hit.type === 'milestone') {
        this.canvas.style.cursor = 'pointer';
      } else if (hit.type === 'group-row') {
        this.canvas.style.cursor = 'pointer';
      }
    } else {
      this.canvas.style.cursor = 'default';
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    const wasClick = this.totalMouseMove < CLICK_THRESHOLD;

    if (this.dragState && !wasClick && this.previewDates) {
      // Commit drag
      if (this.dragState.type === 'move-milestone') {
        if (this.previewDates.date) {
          this.callbacks.onMilestoneUpdate(this.dragState.id, { date: this.previewDates.date });
        }
      } else {
        const updates: { start_date?: string; end_date?: string } = {};
        if (this.previewDates.start_date) updates.start_date = this.previewDates.start_date;
        if (this.previewDates.end_date) updates.end_date = this.previewDates.end_date;
        this.callbacks.onTaskUpdate(this.dragState.id, updates);
      }
    } else if (wasClick) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = this.hitTest(x, y);

      if (hit) {
        if (hit.type === 'group-row') {
          this.callbacks.onGroupToggle(hit.id);
        } else if (hit.type === 'milestone') {
          this.callbacks.onSelect(hit.id, 'milestone');
        } else {
          this.callbacks.onSelect(hit.id, 'task');
        }
      }
    }

    this.dragState = null;
    this.previewDates = null;
    this.totalMouseMove = 0;
    this.canvas.style.cursor = 'default';
    this.callbacks.onRequestRender();
  };

  private onMouseLeave = (_e: MouseEvent) => {
    // Only cancel if actively dragging -- commit nothing, revert preview
    if (this.dragState) {
      this.dragState = null;
      this.previewDates = null;
      this.totalMouseMove = 0;
      this.canvas.style.cursor = 'default';
      this.callbacks.onRequestRender();
    }
  };
}
