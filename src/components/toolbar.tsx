import { useState } from 'react';
import { useProjectStore } from '@/lib/state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  FilePlus, FolderOpen, Save, Plus, Diamond, Layers,
  ZoomIn, ZoomOut, Undo2, Redo2
} from 'lucide-react';
import type { ViewMode } from '@/lib/types';

export function Toolbar() {
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newGroupDialog, setNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newTaskDialog, setNewTaskDialog] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPredecessor, setNewTaskPredecessor] = useState('__none__');
  const [newTaskGroupId, setNewTaskGroupId] = useState('');

  const project = useProjectStore((s) => s.project);
  const isDirty = useProjectStore((s) => s.isDirty);
  const viewMode = useProjectStore((s) => s.viewMode);
  const newProject = useProjectStore((s) => s.newProject);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const addGroup = useProjectStore((s) => s.addGroup);
  const addTask = useProjectStore((s) => s.addTask);
  const addMilestone = useProjectStore((s) => s.addMilestone);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const zoomIn = useProjectStore((s) => s.zoomIn);
  const zoomOut = useProjectStore((s) => s.zoomOut);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const undoStack = useProjectStore((s) => s.undoStack);
  const redoStack = useProjectStore((s) => s.redoStack);

  const firstGroupId = project?.groups?.[0]?.id;

  const handleNewProject = () => {
    if (newProjectName.trim()) {
      newProject(newProjectName.trim());
      setNewProjectDialog(false);
      setNewProjectName('');
    }
  };

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      addGroup(newGroupName.trim());
      setNewGroupDialog(false);
      setNewGroupName('');
    }
  };

  const handleAddTask = () => {
    const groupId = newTaskGroupId || firstGroupId;
    if (!groupId) return;

    const options: { name?: string; start_date?: string; dependencies?: string[]; starts_after?: string } = {};
    if (newTaskName.trim()) options.name = newTaskName.trim();

    if (newTaskPredecessor && newTaskPredecessor !== '__none__') {
      const predTask = project?.tasks.find((t) => t.id === newTaskPredecessor);
      const predMilestone = project?.milestones.find((m) => m.id === newTaskPredecessor);

      if (predTask?.end_date) {
        options.start_date = predTask.end_date;
      } else if (predMilestone?.date) {
        options.start_date = predMilestone.date;
      }
      options.dependencies = [newTaskPredecessor];
      options.starts_after = newTaskPredecessor;
    }

    addTask(groupId, options);
    setNewTaskDialog(false);
    setNewTaskName('');
    setNewTaskPredecessor('__none__');
    setNewTaskGroupId('');
  };

  return (
    <>
      <div className="h-12 border-b border-border bg-card flex items-center px-3 gap-1 shrink-0">
        {/* File operations */}
        <Button variant="ghost" size="sm" onClick={() => setNewProjectDialog(true)} title="New Project">
          <FilePlus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={openProject} title="Open Project">
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={saveProject}
          disabled={!project}
          title="Save"
        >
          <Save className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <Button variant="ghost" size="sm" onClick={undo} disabled={undoStack.length === 0} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={redoStack.length === 0} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Add items */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNewGroupDialog(true)}
          disabled={!project}
          title="Add Group"
        >
          <Layers className="h-4 w-4 mr-1" />
          <span className="text-xs">Group</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setNewTaskGroupId(firstGroupId || '');
            setNewTaskDialog(true);
          }}
          disabled={!project || !firstGroupId}
          title="Add Task"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span className="text-xs">Task</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => firstGroupId && addMilestone(firstGroupId)}
          disabled={!project || !firstGroupId}
          title="Add Milestone"
        >
          <Diamond className="h-4 w-4 mr-1" />
          <span className="text-xs">Milestone</span>
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom */}
        <Button variant="ghost" size="sm" onClick={zoomOut} disabled={!project} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={zoomIn} disabled={!project} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>

        <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} disabled={!project}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>

        {/* Spacer + project name */}
        <div className="flex-1" />
        {project && (
          <span className="text-sm text-muted-foreground">
            {project.project.name}
            {isDirty && ' *'}
          </span>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewProject} disabled={!newProjectName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={newGroupDialog} onOpenChange={setNewGroupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Group name (e.g., Phase 1: Planning)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Task Dialog */}
      <Dialog open={newTaskDialog} onOpenChange={(open) => {
        setNewTaskDialog(open);
        if (!open) {
          setNewTaskName('');
          setNewTaskPredecessor('__none__');
          setNewTaskGroupId('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Task Name</Label>
              <Input
                placeholder="Task name"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                autoFocus
              />
            </div>

            {project && project.groups.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Group</Label>
                <Select value={newTaskGroupId} onValueChange={(v) => v && setNewTaskGroupId(v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <span>{project.groups.find(g => g.id === newTaskGroupId)?.name || 'Select group'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {project.groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Starts After (optional)</Label>
              <Select value={newTaskPredecessor} onValueChange={(v) => setNewTaskPredecessor(v ?? '__none__')}>
                <SelectTrigger className="h-8 text-sm">
                  <span>{
                    newTaskPredecessor === '__none__' ? 'None'
                    : project?.tasks.find(t => t.id === newTaskPredecessor)?.name
                      ?? project?.milestones.find(m => m.id === newTaskPredecessor)?.name
                      ?? 'None'
                  }</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {project?.tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  {project?.milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask}>
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
