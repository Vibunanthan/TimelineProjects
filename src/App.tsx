import { useEffect } from 'react';
import { useProjectStore } from '@/lib/state';
import { Toolbar } from '@/components/toolbar';
import { TaskList } from '@/components/task-list';
import { GanttCanvas } from '@/components/gantt-canvas';
import { EditPanel } from '@/components/edit-panel';
import { WelcomeScreen } from '@/components/welcome-screen';

function App() {
  const project = useProjectStore((s) => s.project);
  const saveProject = useProjectStore((s) => s.saveProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const deleteMilestone = useProjectStore((s) => s.deleteMilestone);
  const selectedId = useProjectStore((s) => s.selectedId);
  const selectedType = useProjectStore((s) => s.selectedType);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 's') {
        e.preventDefault();
        saveProject();
      } else if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' && selectedId) {
        if (selectedType === 'task') deleteTask(selectedId);
        else if (selectedType === 'milestone') deleteMilestone(selectedId);
      } else if (e.key === 'Escape') {
        useProjectStore.getState().closeEditPanel();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveProject, undo, redo, deleteTask, deleteMilestone, selectedId, selectedType]);

  if (!project) {
    return (
      <div className="h-screen flex flex-col">
        <Toolbar />
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <TaskList />
        <GanttCanvas />
      </div>
      <EditPanel />
    </div>
  );
}

export default App;
