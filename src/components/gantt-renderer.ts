import type { Task, Milestone, Group, HitRegion, RowLayout, ViewMode } from '@/lib/types';
import { parseDate, isWeekendDay } from '@/lib/date-utils';
import { addDays, format, differenceInDays, startOfMonth, eachMonthOfInterval, eachWeekOfInterval, getISOWeek } from 'date-fns';

const ROW_HEIGHT = 36;
const GROUP_ROW_HEIGHT = 32;
const BAR_HEIGHT = 22;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const MILESTONE_SIZE = 14;
const HEADER_HEIGHT = 64;
const BAR_RADIUS = 4;
const EDGE_WIDTH = 10;

const COMPLETED_COLOR = '#22C55E';
const OVERDUE_COLOR = '#EF4444';

function getTaskDisplayColor(task: Task): string {
  if (task.completed) return COMPLETED_COLOR;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = parseDate(task.end_date);
  if (endDate < today) return OVERDUE_COLOR;
  return task.color;
}

export interface RenderConfig {
  tasks: Task[];
  milestones: Milestone[];
  groups: Group[];
  collapsedGroups: Set<string>;
  pixelsPerDay: number;
  scrollX: number;
  scrollY: number;
  canvasWidth: number;
  canvasHeight: number;
  selectedId: string | null;
  viewMode: ViewMode;
  dpr: number;
}

export interface RenderResult {
  hitRegions: HitRegion[];
  rowLayouts: RowLayout[];
  totalHeight: number;
  timelineStartDate: Date;
  timelineEndDate: Date;
}

function getTimelineRange(tasks: Task[], milestones: Milestone[]): { start: Date; end: Date } {
  const dates: Date[] = [];
  for (const t of tasks) {
    if (t.start_date) dates.push(parseDate(t.start_date));
    if (t.end_date) dates.push(parseDate(t.end_date));
  }
  for (const m of milestones) {
    if (m.date) dates.push(parseDate(m.date));
  }

  if (dates.length === 0) {
    const today = new Date();
    return {
      start: new Date(today.getFullYear(), 0, 1),
      end: new Date(today.getFullYear(), 11, 31),
    };
  }

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  let start = addDays(minDate, -14);
  let end = addDays(maxDate, 30);

  // Ensure minimum 365-day span
  if (differenceInDays(end, start) < 365) {
    end = addDays(start, 365);
  }

  return { start, end };
}

function dateToX(date: Date, startDate: Date, pixelsPerDay: number): number {
  return differenceInDays(date, startDate) * pixelsPerDay;
}

export function renderGantt(
  ctx: CanvasRenderingContext2D,
  config: RenderConfig
): RenderResult {
  const { tasks, milestones, groups, collapsedGroups, pixelsPerDay, scrollX, scrollY, canvasWidth, canvasHeight, selectedId, viewMode, dpr } = config;

  const hitRegions: HitRegion[] = [];
  const rowLayouts: RowLayout[] = [];

  ctx.save();
  ctx.scale(dpr, dpr);

  // Clear
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const { start: timelineStart, end: timelineEnd } = getTimelineRange(tasks, milestones);
  const totalDays = differenceInDays(timelineEnd, timelineStart);

  // Build row layout
  let currentY = HEADER_HEIGHT;
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  for (const group of sortedGroups) {
    rowLayouts.push({ id: group.id, type: 'group', y: currentY, groupId: group.id });
    currentY += GROUP_ROW_HEIGHT;

    if (!collapsedGroups.has(group.id)) {
      const groupTasks = tasks.filter((t) => t.group_id === group.id);
      for (const task of groupTasks) {
        rowLayouts.push({ id: task.id, type: 'task', y: currentY, groupId: group.id });
        currentY += ROW_HEIGHT;
      }
      const groupMilestones = milestones.filter((m) => m.group_id === group.id);
      for (const ms of groupMilestones) {
        rowLayouts.push({ id: ms.id, type: 'milestone', y: currentY, groupId: group.id });
        currentY += ROW_HEIGHT;
      }
    }
  }

  const totalHeight = currentY;

  // Draw weekend shading
  ctx.fillStyle = '#f5f5f5';
  for (let d = 0; d < totalDays; d++) {
    const date = addDays(timelineStart, d);
    if (isWeekendDay(date)) {
      const x = d * pixelsPerDay - scrollX;
      if (x + pixelsPerDay > 0 && x < canvasWidth) {
        ctx.fillRect(x, HEADER_HEIGHT, pixelsPerDay, canvasHeight);
      }
    }
  }

  // Draw horizontal grid lines
  ctx.strokeStyle = '#eeeeee';
  ctx.lineWidth = 0.5;
  for (const row of rowLayouts) {
    const y = row.y - scrollY;
    if (y > HEADER_HEIGHT && y < canvasHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }

  // Draw timeline header
  drawTimelineHeader(ctx, timelineStart, timelineEnd, pixelsPerDay, scrollX, canvasWidth, viewMode);

  // Draw today line
  const todayX = dateToX(new Date(), timelineStart, pixelsPerDay) - scrollX;
  if (todayX > 0 && todayX < canvasWidth) {
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(todayX, HEADER_HEIGHT);
    ctx.lineTo(todayX, canvasHeight);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw groups and items
  for (const row of rowLayouts) {
    const y = row.y - scrollY;
    if (y + ROW_HEIGHT < HEADER_HEIGHT || y > canvasHeight) continue;

    if (row.type === 'group') {
      const group = groups.find((g) => g.id === row.id)!;
      drawGroupRow(ctx, group, y, canvasWidth, collapsedGroups.has(group.id), selectedId === group.id);
      hitRegions.push({
        type: 'group-row',
        id: group.id,
        x: 0,
        y: row.y - scrollY,
        w: canvasWidth,
        h: GROUP_ROW_HEIGHT,
      });
    } else if (row.type === 'task') {
      const task = tasks.find((t) => t.id === row.id)!;
      if (task) {
        drawTaskBar(ctx, task, y, timelineStart, pixelsPerDay, scrollX, selectedId === task.id, hitRegions);
      }
    } else if (row.type === 'milestone') {
      const ms = milestones.find((m) => m.id === row.id)!;
      if (ms) {
        drawMilestone(ctx, ms, y, timelineStart, pixelsPerDay, scrollX, selectedId === ms.id, hitRegions);
      }
    }
  }

  // Draw dependency arrows
  drawDependencyArrows(ctx, tasks, milestones, rowLayouts, timelineStart, pixelsPerDay, scrollX, scrollY);

  // Draw header background overlay to cover scrolled content
  ctx.fillRect(0, 0, canvasWidth, HEADER_HEIGHT);
  drawTimelineHeader(ctx, timelineStart, timelineEnd, pixelsPerDay, scrollX, canvasWidth, viewMode);

  ctx.restore();

  return { hitRegions, rowLayouts, totalHeight, timelineStartDate: timelineStart, timelineEndDate: timelineEnd };
}

function drawTimelineHeader(
  ctx: CanvasRenderingContext2D,
  start: Date,
  end: Date,
  pixelsPerDay: number,
  scrollX: number,
  canvasWidth: number,
  _viewMode: ViewMode
) {
  // Header background with gradient
  const headerGrad = ctx.createLinearGradient(0, 0, 0, HEADER_HEIGHT);
  headerGrad.addColorStop(0, '#1e293b');
  headerGrad.addColorStop(1, '#334155');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, canvasWidth, HEADER_HEIGHT);

  // Bottom border
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_HEIGHT);
  ctx.lineTo(canvasWidth, HEADER_HEIGHT);
  ctx.stroke();

  // Month labels (top row)
  const months = eachMonthOfInterval({ start, end });
  ctx.textAlign = 'left';

  for (const monthStart of months) {
    const x = dateToX(monthStart, start, pixelsPerDay) - scrollX;
    const monthEnd = startOfMonth(addDays(monthStart, 32));
    const monthWidth = dateToX(monthEnd, start, pixelsPerDay) - scrollX - x;

    if (x + monthWidth > 0 && x < canvasWidth) {
      // Month background highlight
      ctx.fillStyle = '#ffffff08';
      ctx.fillRect(x, 0, monthWidth, 28);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(format(monthStart, 'MMMM yyyy'), Math.max(x + 10, 6), 19);

      // Month divider
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEADER_HEIGHT);
      ctx.stroke();
    }
  }

  // Week labels (bottom row) if zoom is appropriate
  if (pixelsPerDay >= 8) {
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

    for (const weekStart of weeks) {
      const x = dateToX(weekStart, start, pixelsPerDay) - scrollX;
      if (x > -100 && x < canvasWidth) {
        const weekNum = getISOWeek(weekStart);
        const weekWidth = 7 * pixelsPerDay;

        // Week number badge
        const badgeText = `W${weekNum}`;
        ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
        const badgeWidth = ctx.measureText(badgeText).width + 8;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        roundRect(ctx, x + 3, 30, badgeWidth, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(badgeText, x + 7, 42);

        // Date label next to badge
        if (weekWidth > 70) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '400 10px "Segoe UI", system-ui, sans-serif';
          ctx.fillText(format(weekStart, 'MMM d'), x + badgeWidth + 6, 42);
        }

        // Week divider
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 28);
        ctx.lineTo(x, HEADER_HEIGHT);
        ctx.stroke();
      }
    }
  }

  // Day labels if very zoomed in
  if (pixelsPerDay >= 25) {
    const totalDays = differenceInDays(end, start);
    ctx.font = '500 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';

    for (let d = 0; d < totalDays; d++) {
      const date = addDays(start, d);
      const x = d * pixelsPerDay - scrollX + pixelsPerDay / 2;
      if (x > 0 && x < canvasWidth) {
        const isWeekend = isWeekendDay(date);
        ctx.fillStyle = isWeekend ? '#64748b' : '#cbd5e1';
        ctx.fillText(format(date, 'd'), x, 58);
      }
    }
    ctx.textAlign = 'left';
  }
}

function drawGroupRow(
  ctx: CanvasRenderingContext2D,
  group: Group,
  y: number,
  width: number,
  collapsed: boolean,
  selected: boolean
) {
  // Background
  ctx.fillStyle = selected ? '#e8f4fd' : '#f0f0f0';
  ctx.fillRect(0, y, width, GROUP_ROW_HEIGHT);

  // Bottom border
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + GROUP_ROW_HEIGHT);
  ctx.lineTo(width, y + GROUP_ROW_HEIGHT);
  ctx.stroke();

  // Collapse indicator
  ctx.fillStyle = '#666666';
  ctx.font = '400 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(collapsed ? '\u25B6' : '\u25BC', 8, y + 21);

  // Group name
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(group.name, 26, y + 21);

  // Color indicator
  ctx.fillStyle = group.color;
  ctx.fillRect(0, y, 3, GROUP_ROW_HEIGHT);
}

function drawTaskBar(
  ctx: CanvasRenderingContext2D,
  task: Task,
  y: number,
  timelineStart: Date,
  pixelsPerDay: number,
  scrollX: number,
  selected: boolean,
  hitRegions: HitRegion[]
) {
  if (!task.start_date || !task.end_date) return;

  const startX = dateToX(parseDate(task.start_date), timelineStart, pixelsPerDay) - scrollX;
  const endX = dateToX(parseDate(task.end_date), timelineStart, pixelsPerDay) - scrollX;
  const barWidth = Math.max(endX - startX, pixelsPerDay); // Minimum 1 day width
  const barY = y + BAR_Y_OFFSET;

  const displayColor = getTaskDisplayColor(task);

  // Selection highlight
  if (selected) {
    ctx.fillStyle = '#0078d420';
    ctx.fillRect(startX - 4, barY - 2, barWidth + 8, BAR_HEIGHT + 4);
  }

  // Bar background
  ctx.fillStyle = displayColor + '30';
  ctx.beginPath();
  roundRect(ctx, startX, barY, barWidth, BAR_HEIGHT, BAR_RADIUS);
  ctx.fill();

  // Completed: fill entire bar with green tint
  if (task.completed) {
    ctx.fillStyle = displayColor + '50';
    ctx.beginPath();
    roundRect(ctx, startX, barY, barWidth, BAR_HEIGHT, BAR_RADIUS);
    ctx.fill();
  } else if (task.progress > 0) {
    // Progress fill
    const progressWidth = (barWidth * task.progress) / 100;
    ctx.fillStyle = displayColor;
    ctx.beginPath();
    roundRect(ctx, startX, barY, progressWidth, BAR_HEIGHT, BAR_RADIUS);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = displayColor;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.beginPath();
  roundRect(ctx, startX, barY, barWidth, BAR_HEIGHT, BAR_RADIUS);
  ctx.stroke();

  // Completed checkmark
  if (task.completed) {
    const checkX = startX + 4;
    const checkY = barY + BAR_HEIGHT / 2;
    ctx.strokeStyle = COMPLETED_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(checkX, checkY);
    ctx.lineTo(checkX + 4, checkY + 4);
    ctx.lineTo(checkX + 10, checkY - 4);
    ctx.stroke();
  }

  // Task name
  const nameOffset = task.completed ? 18 : 6;
  ctx.fillStyle = task.completed ? '#166534' : '#1a1a1a';
  ctx.font = task.completed ? 'italic 400 11px "Segoe UI", system-ui, sans-serif' : '400 11px "Segoe UI", system-ui, sans-serif';
  const textX = startX + nameOffset;
  const maxTextWidth = barWidth - nameOffset - 6;
  if (maxTextWidth > 20) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, barY, barWidth, BAR_HEIGHT);
    ctx.clip();
    ctx.fillText(task.name, textX, barY + 15);
    ctx.restore();
  }

  // Hit regions
  hitRegions.push({
    type: 'bar-left-edge',
    id: task.id,
    x: startX - EDGE_WIDTH / 2,
    y: barY,
    w: EDGE_WIDTH,
    h: BAR_HEIGHT,
  });
  hitRegions.push({
    type: 'bar-right-edge',
    id: task.id,
    x: startX + barWidth - EDGE_WIDTH / 2,
    y: barY,
    w: EDGE_WIDTH,
    h: BAR_HEIGHT,
  });
  hitRegions.push({
    type: 'bar-body',
    id: task.id,
    x: startX + EDGE_WIDTH / 2,
    y: barY,
    w: barWidth - EDGE_WIDTH,
    h: BAR_HEIGHT,
  });
}

function drawMilestone(
  ctx: CanvasRenderingContext2D,
  ms: Milestone,
  y: number,
  timelineStart: Date,
  pixelsPerDay: number,
  scrollX: number,
  selected: boolean,
  hitRegions: HitRegion[]
) {
  if (!ms.date) return;

  const x = dateToX(parseDate(ms.date), timelineStart, pixelsPerDay) - scrollX;
  const centerY = y + ROW_HEIGHT / 2;

  // Diamond shape
  ctx.fillStyle = ms.color;
  ctx.beginPath();
  ctx.moveTo(x, centerY - MILESTONE_SIZE);
  ctx.lineTo(x + MILESTONE_SIZE, centerY);
  ctx.lineTo(x, centerY + MILESTONE_SIZE);
  ctx.lineTo(x - MILESTONE_SIZE, centerY);
  ctx.closePath();
  ctx.fill();

  if (selected) {
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '400 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(ms.name, x + MILESTONE_SIZE + 6, centerY + 4);

  hitRegions.push({
    type: 'milestone',
    id: ms.id,
    x: x - MILESTONE_SIZE,
    y: centerY - MILESTONE_SIZE,
    w: MILESTONE_SIZE * 2,
    h: MILESTONE_SIZE * 2,
  });
}

function drawDependencyArrows(
  ctx: CanvasRenderingContext2D,
  tasks: Task[],
  milestones: Milestone[],
  rowLayouts: RowLayout[],
  timelineStart: Date,
  pixelsPerDay: number,
  scrollX: number,
  scrollY: number
) {
  const allItems = [...tasks, ...milestones];
  const rowMap = new Map(rowLayouts.map((r) => [r.id, r]));

  for (const item of allItems) {
    if (!item.dependencies || item.dependencies.length === 0) continue;

    const targetRow = rowMap.get(item.id);
    if (!targetRow) continue;

    for (const depId of item.dependencies) {
      const sourceRow = rowMap.get(depId);
      if (!sourceRow) continue;

      const sourceItem = allItems.find((i) => i.id === depId);
      if (!sourceItem) continue;

      // Get source end point
      let sourceX: number;
      if ('end_date' in sourceItem && sourceItem.end_date) {
        sourceX = dateToX(parseDate(sourceItem.end_date), timelineStart, pixelsPerDay) - scrollX;
      } else if ('date' in sourceItem && sourceItem.date) {
        sourceX = dateToX(parseDate(sourceItem.date), timelineStart, pixelsPerDay) - scrollX;
      } else continue;

      // Get target start point
      let targetX: number;
      if ('start_date' in item && item.start_date) {
        targetX = dateToX(parseDate(item.start_date), timelineStart, pixelsPerDay) - scrollX;
      } else if ('date' in item && item.date) {
        targetX = dateToX(parseDate(item.date), timelineStart, pixelsPerDay) - scrollX;
      } else continue;

      const sourceY = sourceRow.y - scrollY + ROW_HEIGHT / 2;
      const targetY = targetRow.y - scrollY + ROW_HEIGHT / 2;

      // Draw arrow using quadratic bezier
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);

      const midX = sourceX + (targetX - sourceX) * 0.5;
      if (Math.abs(sourceY - targetY) < ROW_HEIGHT) {
        // Same row or adjacent: simple curve
        ctx.quadraticCurveTo(midX, sourceY, targetX, targetY);
      } else {
        // Different rows: go down then across
        ctx.lineTo(sourceX + 10, sourceY);
        ctx.lineTo(sourceX + 10, targetY);
        ctx.lineTo(targetX, targetY);
      }
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(targetY - (sourceY + targetY) / 2, targetX - midX);
      ctx.fillStyle = '#999999';
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX - 8 * Math.cos(angle - 0.4), targetY - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(targetX - 8 * Math.cos(angle + 0.4), targetY - 8 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

export { ROW_HEIGHT, GROUP_ROW_HEIGHT, HEADER_HEIGHT, dateToX, getTimelineRange };
