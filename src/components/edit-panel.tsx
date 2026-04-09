import { useProjectStore } from '@/lib/state';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Trash2 } from 'lucide-react';

export function EditPanel() {
  const project = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedId);
  const selectedType = useProjectStore((s) => s.selectedType);
  const editPanelOpen = useProjectStore((s) => s.editPanelOpen);
  const closeEditPanel = useProjectStore((s) => s.closeEditPanel);
  const updateTask = useProjectStore((s) => s.updateTask);
  const updateMilestone = useProjectStore((s) => s.updateMilestone);
  const updateGroup = useProjectStore((s) => s.updateGroup);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const deleteMilestone = useProjectStore((s) => s.deleteMilestone);
  const deleteGroup = useProjectStore((s) => s.deleteGroup);

  if (!project || !selectedId) return null;

  const task = selectedType === 'task' ? project.tasks.find((t) => t.id === selectedId) : null;
  const milestone = selectedType === 'milestone' ? project.milestones.find((m) => m.id === selectedId) : null;
  const group = selectedType === 'group' ? project.groups.find((g) => g.id === selectedId) : null;

  const allTasks = project.tasks;
  const allMilestones = project.milestones;
  const allItems = [...allTasks, ...allMilestones];

  return (
    <Sheet open={editPanelOpen} onOpenChange={(open) => !open && closeEditPanel()}>
      <SheetContent className="w-80 sm:w-80 overflow-y-auto px-6">
        <SheetHeader className="pl-1">
          <SheetTitle className="text-sm">
            {task ? 'Edit Task' : milestone ? 'Edit Milestone' : 'Edit Group'}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pl-1">
          {/* Task editor */}
          {task && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={task.name}
                  onChange={(e) => updateTask(task.id, { name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={task.start_date}
                    onChange={(e) => updateTask(task.id, { start_date: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={task.end_date}
                    onChange={(e) => updateTask(task.id, { end_date: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Group</Label>
                <Select
                  value={task.group_id || undefined}
                  onValueChange={(v) => v && updateTask(task.id, { group_id: v })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <span>{project.groups.find(g => g.id === task.group_id)?.name || 'Select group'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {project.groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Progress (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={task.progress}
                  onChange={(e) => updateTask(task.id, { progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={task.color}
                    onChange={(e) => updateTask(task.id, { color: e.target.value })}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={task.color}
                    onChange={(e) => updateTask(task.id, { color: e.target.value })}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Dependencies</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded-md p-2">
                  {allItems
                    .filter((item) => item.id !== task.id)
                    .map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.dependencies.includes(item.id)}
                          onChange={(e) => {
                            const deps = e.target.checked
                              ? [...task.dependencies, item.id]
                              : task.dependencies.filter((d) => d !== item.id);
                            updateTask(task.id, { dependencies: deps });
                          }}
                          className="rounded"
                        />
                        {'name' in item ? item.name : ''}
                      </label>
                    ))}
                  {allItems.filter((item) => item.id !== task.id).length === 0 && (
                    <span className="text-xs text-muted-foreground">No other tasks available</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <textarea
                  value={task.notes}
                  onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                  className="w-full h-20 text-sm border border-border rounded-md p-2 resize-none bg-background"
                  placeholder="Add notes..."
                />
              </div>

              <Separator />

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => deleteTask(task.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Task
              </Button>
            </>
          )}

          {/* Milestone editor */}
          {milestone && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={milestone.name}
                  onChange={(e) => updateMilestone(milestone.id, { name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={milestone.date}
                  onChange={(e) => updateMilestone(milestone.id, { date: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Group</Label>
                <Select
                  value={milestone.group_id || undefined}
                  onValueChange={(v) => v && updateMilestone(milestone.id, { group_id: v })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <span>{project.groups.find(g => g.id === milestone.group_id)?.name || 'Select group'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {project.groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={milestone.color}
                    onChange={(e) => updateMilestone(milestone.id, { color: e.target.value })}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={milestone.color}
                    onChange={(e) => updateMilestone(milestone.id, { color: e.target.value })}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Dependencies</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded-md p-2">
                  {allItems
                    .filter((item) => item.id !== milestone.id)
                    .map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={milestone.dependencies.includes(item.id)}
                          onChange={(e) => {
                            const deps = e.target.checked
                              ? [...milestone.dependencies, item.id]
                              : milestone.dependencies.filter((d) => d !== item.id);
                            updateMilestone(milestone.id, { dependencies: deps });
                          }}
                          className="rounded"
                        />
                        {'name' in item ? item.name : ''}
                      </label>
                    ))}
                </div>
              </div>

              <Separator />

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => deleteMilestone(milestone.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Milestone
              </Button>
            </>
          )}

          {/* Group editor */}
          {group && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={group.name}
                  onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={group.color}
                    onChange={(e) => updateGroup(group.id, { color: e.target.value })}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={group.color}
                    onChange={(e) => updateGroup(group.id, { color: e.target.value })}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>

              <Separator />

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => deleteGroup(group.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Group
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
