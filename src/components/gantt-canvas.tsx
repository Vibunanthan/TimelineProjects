import { useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/lib/state';
import { renderGantt, type RenderResult } from './gantt-renderer';
import { GanttInteractionHandler } from './gantt-interactions';

export function GanttCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<GanttInteractionHandler | null>(null);
  const renderResultRef = useRef<RenderResult | null>(null);

  const project = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedId);
  const pixelsPerDay = useProjectStore((s) => s.pixelsPerDay);
  const scrollX = useProjectStore((s) => s.scrollX);
  const scrollY = useProjectStore((s) => s.scrollY);
  const collapsedGroups = useProjectStore((s) => s.collapsedGroups);
  const viewMode = useProjectStore((s) => s.viewMode);
  const select = useProjectStore((s) => s.select);
  const updateTask = useProjectStore((s) => s.updateTask);
  const updateMilestone = useProjectStore((s) => s.updateMilestone);
  const toggleGroupCollapse = useProjectStore((s) => s.toggleGroupCollapse);
  const setScrollX = useProjectStore((s) => s.setScrollX);
  const setScrollY = useProjectStore((s) => s.setScrollY);

  const doRender = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !project) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d')!;

    // Apply preview dates from interaction handler if dragging
    let tasks = project.tasks;
    let milestones = project.milestones;
    const handler = interactionRef.current;
    if (handler?.previewDates) {
      const preview = handler.previewDates;
      tasks = tasks.map((t) => {
        if (t.id !== preview.id) return t;
        return {
          ...t,
          ...(preview.start_date && { start_date: preview.start_date }),
          ...(preview.end_date && { end_date: preview.end_date }),
        };
      });
      milestones = milestones.map((m) => {
        if (m.id !== preview.id) return m;
        return { ...m, ...(preview.date && { date: preview.date }) };
      });
    }

    const result = renderGantt(ctx, {
      tasks,
      milestones,
      groups: project.groups,
      collapsedGroups,
      pixelsPerDay,
      scrollX,
      scrollY,
      canvasWidth: width,
      canvasHeight: height,
      selectedId,
      viewMode,
      dpr,
    });

    renderResultRef.current = result;
    if (handler) {
      handler.updateHitRegions(result.hitRegions);
    }
  }, [project, selectedId, pixelsPerDay, scrollX, scrollY, collapsedGroups, viewMode]);

  // Set up interaction handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handler = new GanttInteractionHandler(canvas, {
      onSelect: (id, type) => {
        if (!id) {
          select(null, null);
        } else {
          select(id, type);
        }
      },
      onTaskUpdate: (id, updates) => {
        updateTask(id, updates);
      },
      onMilestoneUpdate: (id, updates) => {
        updateMilestone(id, updates);
      },
      onGroupToggle: (id) => {
        toggleGroupCollapse(id);
      },
      onRequestRender: () => {
        requestAnimationFrame(doRender);
      },
      getPixelsPerDay: () => useProjectStore.getState().pixelsPerDay,
      getTimelineStartDate: () => {
        return renderResultRef.current?.timelineStartDate || new Date();
      },
      getTaskDates: (id: string) => {
        const state = useProjectStore.getState();
        const task = state.project?.tasks.find((t) => t.id === id);
        return task ? { start_date: task.start_date, end_date: task.end_date } : null;
      },
      getMilestoneDate: (id: string) => {
        const state = useProjectStore.getState();
        const ms = state.project?.milestones.find((m) => m.id === id);
        return ms?.date || null;
      },
    });

    interactionRef.current = handler;

    return () => {
      handler.destroy();
      interactionRef.current = null;
    };
  }, []);

  // Render on state changes
  useEffect(() => {
    doRender();
  }, [doRender]);

  // Handle resize
  useEffect(() => {
    const observer = new ResizeObserver(() => doRender());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [doRender]);

  // Handle wheel scroll
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        setScrollX(Math.max(0, scrollX + e.deltaY));
      } else {
        setScrollY(Math.max(0, scrollY + e.deltaY));
        setScrollX(Math.max(0, scrollX + e.deltaX));
      }
    },
    [scrollX, scrollY, setScrollX, setScrollY]
  );

  if (!project) return null;

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-background" onWheel={onWheel}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
