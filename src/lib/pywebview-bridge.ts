/**
 * Browser-native file bridge using the File System Access API.
 * No Python backend needed -- everything runs in the browser.
 */

// Store the file handle so we can "Save" without re-prompting
let currentFileHandle: FileSystemFileHandle | null = null;

const FILE_TYPES = [
  {
    description: 'Gantt Project Files',
    accept: { 'application/json': ['.gantt', '.json'] },
  },
];

export const bridge = {
  async newProject(name: string): Promise<any> {
    currentFileHandle = null;
    return {
      schema_version: '1.0',
      project: {
        name,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      },
      view_settings: {
        zoom: 'week',
        scroll_date: new Date().toISOString().split('T')[0],
        collapsed_groups: [],
      },
      groups: [],
      tasks: [],
      milestones: [],
    };
  },

  async openProject(): Promise<{
    data?: any;
    path?: string;
    cancelled?: boolean;
    error?: string;
  }> {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: FILE_TYPES,
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      currentFileHandle = handle;
      return { data, path: handle.name };
    } catch (e: any) {
      if (e.name === 'AbortError') return { cancelled: true };
      return { error: e.message };
    }
  },

  async saveProject(
    projectData: any,
    _filePath: string
  ): Promise<{ success?: boolean; path?: string; error?: string }> {
    try {
      if (!currentFileHandle) {
        // No existing handle -- fall through to Save As
        return bridge.saveProjectAs(projectData);
      }
      const writable = await currentFileHandle.createWritable();
      const json = JSON.stringify(projectData, null, 2);
      await writable.write(json);
      await writable.close();
      return { success: true, path: currentFileHandle.name };
    } catch (e: any) {
      if (e.name === 'AbortError') return { success: false };
      return { error: e.message };
    }
  },

  async saveProjectAs(
    projectData: any
  ): Promise<{
    success?: boolean;
    path?: string;
    cancelled?: boolean;
    error?: string;
  }> {
    try {
      const projectName =
        projectData?.project?.name?.replace(/[^a-zA-Z0-9_-]/g, '_') ||
        'project';
      const handle = await window.showSaveFilePicker({
        suggestedName: `${projectName}.gantt`,
        types: FILE_TYPES,
      });
      const writable = await handle.createWritable();
      const json = JSON.stringify(projectData, null, 2);
      await writable.write(json);
      await writable.close();
      currentFileHandle = handle;
      return { success: true, path: handle.name };
    } catch (e: any) {
      if (e.name === 'AbortError') return { cancelled: true };
      return { error: e.message };
    }
  },

  async validateDependencies(
    items: any[]
  ): Promise<{ valid: boolean; error?: string; cycle?: string[] }> {
    // Run dependency validation in-browser (ported from Python scheduler.py)
    const graph: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    const allIds = new Set<string>();

    for (const item of items) {
      allIds.add(item.id);
      if (!inDegree[item.id]) inDegree[item.id] = 0;
      for (const depId of item.dependencies || []) {
        if (!graph[depId]) graph[depId] = [];
        graph[depId].push(item.id);
        inDegree[item.id] = (inDegree[item.id] || 0) + 1;
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const id of allIds) {
      if ((inDegree[id] || 0) === 0) queue.push(id);
    }

    const visited: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      visited.push(node);
      for (const neighbor of graph[node] || []) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      }
    }

    if (visited.length === allIds.size) return { valid: true };

    const cycleNodes = [...allIds].filter((n) => !visited.includes(n));
    const idToName = Object.fromEntries(
      items.map((i) => [i.id, i.name || i.id])
    );
    const cycleNames = cycleNodes.map((n) => idToName[n] || n);

    return {
      valid: false,
      error: `Circular dependency detected involving: ${cycleNames.join(', ')}`,
      cycle: cycleNodes,
    };
  },

  async getRecentFiles(): Promise<{ path: string; name: string }[]> {
    // Browser doesn't persist file handles across sessions easily.
    // Could use IndexedDB + File System Access API handles in the future.
    return [];
  },
};

export default bridge;
