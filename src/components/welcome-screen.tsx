import { useState } from 'react';
import { useProjectStore } from '@/lib/state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilePlus, FolderOpen, BarChart3 } from 'lucide-react';

export function WelcomeScreen() {
  const [projectName, setProjectName] = useState('');
  const newProject = useProjectStore((s) => s.newProject);
  const openProject = useProjectStore((s) => s.openProject);

  const handleCreate = () => {
    if (projectName.trim()) {
      newProject(projectName.trim());
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="text-center mb-8">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-semibold mb-2">Gantt Planner</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage project timelines with interactive Gantt charts.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Create new project</label>
            <div className="flex gap-2">
              <Input
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="flex-1"
              />
              <Button onClick={handleCreate} disabled={!projectName.trim()}>
                <FilePlus className="h-4 w-4 mr-2" />
                Create
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={openProject}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Open existing project
          </Button>
        </div>
      </div>
    </div>
  );
}
