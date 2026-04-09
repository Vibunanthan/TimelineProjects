import { useProjectStore } from '@/lib/state';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Trash2, Paintbrush } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_PALETTE = [
  '#E74C3C', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
  '#795548', '#607D8B', '#9E9E9E', '#1A1A1A',
];

function ColorPalette({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-10 gap-1">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            className={cn(
              'w-6 h-6 rounded border cursor-pointer transition-transform hover:scale-110',
              value.toLowerCase() === color.toLowerCase()
                ? 'border-foreground ring-2 ring-ring scale-110'
                : 'border-border'
            )}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            title={color}
            type="button"
          />
        ))}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
        placeholder="#hex"
      />
    </div>
  );
}

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
  const applyGroupColorToItems = useProjectStore((s) => s.applyGroupColorToItems);

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

              {task.starts_after && (() => {
                const pred = project.tasks.find((t) => t.id === task.starts_after)
                  || project.milestones.find((m) => m.id === task.starts_after);
                return pred ? (
                  <div className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-1.5">
                    Linked: starts after <span className="font-medium text-foreground">{pred.name}</span>
                    <button
                      className="ml-2 text-destructive hover:underline"
                      onClick={() => updateTask(task.id, { starts_after: undefined })}
                    >
                      Unlink
                    </button>
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={task.start_date}
                    onChange={(e) => updateTask(task.id, { start_date: e.target.value })}
                    className="h-8 text-sm"
                    disabled={!!task.starts_after}
                    title={task.starts_after ? 'Linked to predecessor — unlink to edit manually' : undefined}
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
                <ColorPalette
                  value={task.color}
                  onChange={(color) => updateTask(task.id, { color })}
                />
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
                <ColorPalette
                  value={milestone.color}
                  onChange={(color) => updateMilestone(milestone.id, { color })}
                />
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
                <ColorPalette
                  value={group.color}
                  onChange={(color) => updateGroup(group.id, { color })}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => applyGroupColorToItems(group.id)}
              >
                <Paintbrush className="h-4 w-4 mr-1" /> Apply color to all tasks
              </Button>

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
