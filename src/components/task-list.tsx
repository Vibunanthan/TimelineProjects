import { useProjectStore } from '@/lib/state';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Plus, Diamond, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDisplay } from '@/lib/date-utils';
import type { Task } from '@/lib/types';

function getTaskStatusColor(task: Task): { bg: string; dot: string } {
  if (task.completed) return { bg: 'bg-green-50', dot: '#22C55E' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(task.end_date + 'T00:00:00');
  if (endDate < today) return { bg: 'bg-red-50', dot: '#EF4444' };
  return { bg: '', dot: task.color };
}

export function TaskList() {
  const project = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedId);
  const collapsedGroups = useProjectStore((s) => s.collapsedGroups);
  const select = useProjectStore((s) => s.select);
  const toggleGroupCollapse = useProjectStore((s) => s.toggleGroupCollapse);
  const addTask = useProjectStore((s) => s.addTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const setScrollY = useProjectStore((s) => s.setScrollY);

  if (!project) return null;

  const sortedGroups = [...project.groups].sort((a, b) => a.order - b.order);

  return (
    <div
      className="w-64 border-r border-border bg-card flex flex-col shrink-0 overflow-hidden"
    >
      <div className="h-[64px] border-b border-border flex items-center px-3 shrink-0 bg-slate-800">
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Tasks</span>
      </div>
      <div
        className="flex-1 overflow-y-auto"
        onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}
      >
        {sortedGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id);
          const groupTasks = project.tasks.filter((t) => t.group_id === group.id);
          const groupMilestones = project.milestones.filter((m) => m.group_id === group.id);

          return (
            <div key={group.id}>
              {/* Group header */}
              <div
                className={cn(
                  'h-8 flex items-center px-2 gap-1 cursor-pointer hover:bg-muted/50 border-b border-border',
                  selectedId === group.id && 'bg-accent'
                )}
                style={{ borderLeft: `3px solid ${group.color}` }}
                onClick={() => toggleGroupCollapse(group.id)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-semibold truncate flex-1">{group.name}</span>
                <span className="text-[10px] text-muted-foreground">{groupTasks.length}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    addTask(group.id);
                  }}
                  title="Add task"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Tasks and milestones */}
              {!isCollapsed && (
                <>
                  {groupTasks.map((task) => {
                    const status = getTaskStatusColor(task);
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'h-9 flex items-center pl-2 pr-2 cursor-pointer hover:bg-muted/50 border-b border-border/50',
                          selectedId === task.id && 'bg-accent',
                          status.bg
                        )}
                        onClick={() => select(task.id, 'task')}
                      >
                        <button
                          className={cn(
                            'w-4 h-4 rounded border shrink-0 mr-2 flex items-center justify-center transition-colors',
                            task.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-muted-foreground/40 hover:border-muted-foreground'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTask(task.id, { completed: !task.completed });
                          }}
                          title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {task.completed && <Check className="h-3 w-3 text-white" />}
                        </button>
                        <div
                          className="w-2 h-2 rounded-full shrink-0 mr-2"
                          style={{ backgroundColor: status.dot }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            'text-xs truncate',
                            task.completed && 'line-through text-muted-foreground'
                          )}>{task.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {task.start_date && formatDisplay(task.start_date)} - {task.end_date && formatDisplay(task.end_date)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {groupMilestones.map((ms) => (
                    <div
                      key={ms.id}
                      className={cn(
                        'h-9 flex items-center pl-7 pr-2 cursor-pointer hover:bg-muted/50 border-b border-border/50',
                        selectedId === ms.id && 'bg-accent'
                      )}
                      onClick={() => select(ms.id, 'milestone')}
                    >
                      <Diamond
                        className="h-3 w-3 shrink-0 mr-2"
                        style={{ color: ms.color }}
                        fill={ms.color}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs truncate">{ms.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {ms.date && formatDisplay(ms.date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}

        {sortedGroups.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No groups yet. Click "Group" in the toolbar to add one.
          </div>
        )}
      </div>
    </div>
  );
}
