import { useState } from 'react';
import { useProjectStore } from '@/lib/state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
          onClick={() => firstGroupId && addTask(firstGroupId)}
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
    </>
  );
}
