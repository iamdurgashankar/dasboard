import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Task, Project } from '../types';

const PRIORITY_STYLES = {
  Critical: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  High: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Medium: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Low: 'bg-slate-800 text-slate-500 border-slate-700'
};

const TaskCard: React.FC<{
  task: Task;
  onUpdateStatus: (id: string, status: Task['status']) => void;
  onClick: (task: Task) => void;
}> = ({ task, onUpdateStatus, onClick }) => {
  const progress = useMemo(() => {
    if (!task.subtasks?.length) return 0;
    return (task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100;
  }, [task.subtasks]);

  return (
    <div
      onClick={() => onClick(task)}
      className={`bg-slate-900/50 border border-slate-800 p-5 rounded-3xl hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all group animate-in slide-in-from-bottom-2 cursor-pointer relative overflow-hidden ${task.status === 'in-progress' ? 'ring-1 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : ''
        }`}
    >
      {task.status === 'in-progress' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full -mr-16 -mt-16 animate-pulse"></div>
      )}

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="flex gap-2">
          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium}`}>
            {task.priority}
          </span>
          {task.points && (
            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-slate-700 bg-slate-950 text-slate-400">
              {task.points} pts
            </span>
          )}
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {task.status !== 'todo' && (
            <button onClick={() => onUpdateStatus(task.id, 'todo')} className="w-6 h-6 rounded-lg bg-slate-950 text-slate-500 hover:text-indigo-400 flex items-center justify-center text-[10px]" title="Move to Todo">
              <i className="fas fa-undo"></i>
            </button>
          )}
          {task.status !== 'in-progress' && (
            <button onClick={() => onUpdateStatus(task.id, 'in-progress')} className="w-6 h-6 rounded-lg bg-slate-950 text-slate-500 hover:text-amber-400 flex items-center justify-center text-[10px]" title="Move to In Progress">
              <i className="fas fa-play"></i>
            </button>
          )}
          {task.status !== 'completed' && (
            <button onClick={() => onUpdateStatus(task.id, 'completed')} className="w-6 h-6 rounded-lg bg-slate-950 text-slate-500 hover:text-emerald-400 flex items-center justify-center text-[10px]" title="Complete Task">
              <i className="fas fa-check"></i>
            </button>
          )}
        </div>
      </div>

      <h4 className="text-sm font-bold text-slate-100 mb-1 group-hover:text-indigo-400 transition-colors relative z-10">{task.title}</h4>
      <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed font-medium relative z-10">{task.description}</p>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="space-y-1.5 mb-4 relative z-10">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-600">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${task.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-800/50 relative z-10">
        <div className="flex items-center gap-2">
          {task.assigneeAvatar ? (
            <img src={task.assigneeAvatar} className="w-6 h-6 rounded-lg border border-slate-700 shadow-lg" alt="" />
          ) : (
            <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-indigo-400">
              <i className="fas fa-user-circle"></i>
            </div>
          )}
          <span className="text-[10px] font-bold text-slate-400">{task.assignee}</span>
        </div>
        <span className="text-[9px] font-mono text-slate-600 uppercase font-black">{task.projectName || 'Internal'}</span>
      </div>
    </div>
  );
};

const TaskManagement: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  const [newTaskForm, setNewTaskForm] = useState<Partial<Task>>({
    title: '',
    description: '',
    assignee: 'Lead Architect',
    priority: 'Medium',
    points: 3,
    projectId: '',
    dueDate: new Date().toISOString().split('T')[0]
  });

  const currentUser = 'Lead Architect';

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tasksRes, projectsRes] = await Promise.all([
        api.tasks.list(),
        api.projects.list()
      ]);

      // Map snake_case to camelCase
      const mappedTasks = tasksRes.data.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assignee: t.assignee_name || 'Unassigned',
        assigneeAvatar: t.assignee_avatar,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        points: parseInt(t.points),
        projectId: t.project_id,
        projectName: t.project_name,
        tags: t.tags || [],
        subtasks: t.subtasks?.map((st: any) => ({
          id: st.id,
          title: st.title,
          completed: Boolean(parseInt(st.completed)),
          completedAt: st.completed_at
        })) || [],
        comments: t.comments?.map((c: any) => ({
          id: c.id,
          user: c.user_name || 'System',
          avatar: c.user_avatar,
          text: c.text,
          timestamp: c.created_at,
          isSystemLog: Boolean(parseInt(c.is_system_log))
        })) || []
      }));

      setTasks(mappedTasks);
      setProjects(projectsRes.data);
    } catch (err) {
      console.error("Task Sync Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    tasks.forEach(task => {
      if (task.assignee) assignees.add(task.assignee);
    });
    return Array.from(assignees).sort();
  }, [tasks]);

  const stats = useMemo(() => ({
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    totalPoints: tasks.reduce((acc, t) => acc + (t.points || 0), 0),
    total: tasks.length
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filterAssignee === 'me') {
      result = result.filter(t => t.assignee === currentUser);
    } else if (filterAssignee !== 'all') {
      result = result.filter(t => t.assignee === filterAssignee);
    }
    return result;
  }, [tasks, filterAssignee]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title) return;

    try {
      const result = await api.tasks.create({
        projectId: newTaskForm.projectId,
        title: newTaskForm.title,
        description: newTaskForm.description,
        priority: newTaskForm.priority,
        points: newTaskForm.points,
        dueDate: newTaskForm.dueDate,
        tags: ['New']
      });

      if (result.status === 'success') {
        fetchData();
        setIsModalOpen(false);
        setNewTaskForm({ title: '', description: '', assignee: 'Lead Architect', priority: 'Medium', points: 3, projectId: '', dueDate: new Date().toISOString().split('T')[0] });
      }
    } catch (err) {
      console.error("Task Creation Error:", err);
    }
  };

  const updateTaskStatus = async (id: string, status: Task['status']) => {
    try {
      await api.tasks.updateStatus(id, status);
      fetchData();
      if (selectedTask?.id === id) {
        setSelectedTask(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      console.error("Status Update Error:", err);
    }
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const subtask = selectedTask?.subtasks?.find(st => st.id === subtaskId);
    if (!subtask) return;

    try {
      await api.subtasks.toggle(subtaskId, !subtask.completed);
      fetchData();
      if (selectedTask?.id === taskId) {
        const updatedSubtasks = selectedTask.subtasks?.map(st =>
          st.id === subtaskId ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date().toISOString() : undefined } : st
        );
        setSelectedTask(prev => prev ? { ...prev, subtasks: updatedSubtasks } : null);
      }
    } catch (err) {
      console.error("Subtask Toggle Error:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;

    try {
      await api.comments.create(selectedTask.id, newComment);
      setNewComment('');
      fetchData();
      // Optimistically fetching all data for consistency
    } catch (err) {
      console.error("Comment Commit Error:", err);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim() || !selectedTask) return;

    try {
      await api.subtasks.create(selectedTask.id, newSubtask);
      setNewSubtask('');
      fetchData();
    } catch (err) {
      console.error("Subtask Creation Error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center animate-pulse">
          <i className="fas fa-microchip text-3xl text-indigo-400"></i>
        </div>
        <div className="space-y-2 text-center">
          <div className="h-4 bg-slate-800 w-48 rounded mx-auto animate-pulse"></div>
          <div className="h-3 bg-slate-800/50 w-32 rounded mx-auto animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Task Management</h1>
          <p className="text-slate-400 mt-1">Orchestrate engineering payloads and track squad sprint velocity.</p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {/* Personnel Filter Dropdown */}
          <div className="relative group">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl px-5 py-2.5 shadow-sm group-hover:border-indigo-500/50 transition-all cursor-pointer">
              <i className="fas fa-user-gear text-indigo-400 mr-3 text-xs"></i>
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-slate-300 cursor-pointer pr-4"
              >
                <option value="all">Full Roster</option>
                <option value="me">Assigned to Me</option>
                <optgroup label="Team Members">
                  {uniqueAssignees.filter(a => a !== currentUser).map(assignee => (
                    <option key={assignee} value={assignee}>{assignee}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center gap-3"
          >
            <i className="fas fa-plus-circle"></i> New Payload
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Unassigned', val: stats.todo, color: 'indigo', icon: 'fa-list-ul' },
          { label: 'Active Sessions', val: stats.inProgress, color: 'amber', icon: 'fa-bolt-lightning' },
          { label: 'Yield Verified', val: stats.completed, color: 'emerald', icon: 'fa-check-double' },
          { label: 'Total Capacity', val: stats.totalPoints + ' pts', color: 'slate', icon: 'fa-chart-simple' }
        ].map((s, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl group hover:border-slate-700 transition-all">
            <div className={`w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center mb-3 text-${s.color}-400 border border-slate-800 shadow-inner group-hover:scale-110 transition-transform`}>
              <i className={`fas ${s.icon} text-xs`}></i>
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
            <h3 className="text-2xl font-black text-slate-100">{s.val}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Board Columns */}
        {(['todo', 'in-progress', 'completed'] as const).map(col => (
          <div key={col} className="space-y-4">
            <div className="flex items-center justify-between px-3 mb-6">
              <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 ${col === 'todo' ? 'text-slate-500' : col === 'in-progress' ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${col === 'todo' ? 'bg-slate-600' : col === 'in-progress' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  }`}></div>
                {col === 'todo' ? 'Backlog' : col === 'in-progress' ? 'Execution' : 'Verified'}
              </h3>
              <span className="text-[10px] font-bold text-slate-700 font-mono">[{filteredTasks.filter(t => t.status === col).length}]</span>
            </div>
            <div className="space-y-4 min-h-[500px] border-t border-slate-900 pt-4">
              {filteredTasks.filter(t => t.status === col).map(task => (
                <TaskCard key={task.id} task={task} onUpdateStatus={updateTaskStatus} onClick={setSelectedTask} />
              ))}
              {filteredTasks.filter(t => t.status === col).length === 0 && (
                <div className="h-32 border-2 border-dashed border-slate-900 rounded-3xl flex items-center justify-center opacity-30">
                  <p className="text-[9px] font-black uppercase tracking-widest">Pipeline Clear</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Detail View Modal (End-to-End Workflow) */}
      {selectedTask && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-[2.5rem] w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 my-auto">
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${PRIORITY_STYLES[selectedTask.priority] || PRIORITY_STYLES.Medium}`}>
                  {selectedTask.priority} Priority
                </div>
                <div className="h-4 w-px bg-slate-800"></div>
                <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">{selectedTask.id}</h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors bg-slate-800 rounded-full"
              >
                <i className="fas fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
              {/* Main Content Pane */}
              <div className="flex-1 p-6 sm:p-10 space-y-10 sm:space-y-12 lg:border-r border-slate-800/50">
                <section>
                  <div className="flex items-center gap-3 mb-2">
                    <i className="fas fa-folder-open text-indigo-400 text-xs"></i>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{selectedTask.projectName || 'Internal Module'}</span>
                  </div>
                  <h1 className="text-3xl font-black text-white mb-6 leading-tight tracking-tight">{selectedTask.title}</h1>
                  <div className="bg-slate-950/40 rounded-3xl p-8 border border-slate-800/60 text-sm text-slate-400 leading-relaxed font-medium shadow-inner">
                    {selectedTask.description}
                  </div>
                </section>

                {/* Subtasks / Work Breakdown */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
                      <i className="fas fa-sitemap text-indigo-500"></i> Work Breakdown
                    </h4>
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">
                      {Math.round(((selectedTask.subtasks?.filter(st => st.completed).length || 0) / (selectedTask.subtasks?.length || 1)) * 100)}% Verified
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedTask.subtasks?.map(st => (
                      <div
                        key={st.id}
                        onClick={() => toggleSubtask(selectedTask.id, st.id)}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${st.completed
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400/60'
                          : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700 shadow-sm'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'border-slate-700 bg-slate-900'
                            }`}>
                            {st.completed && <i className="fas fa-check text-[10px]"></i>}
                          </div>
                          <span className={`text-xs font-bold ${st.completed ? 'line-through opacity-50' : ''}`}>{st.title}</span>
                        </div>
                        {st.completedAt && (
                          <span className="text-[9px] font-mono text-slate-700 group-hover:text-emerald-500/50 transition-colors uppercase">
                            Done {st.completedAt}
                          </span>
                        )}
                      </div>
                    ))}

                    <form onSubmit={handleAddSubtask} className="pt-2">
                      <div className="flex gap-2">
                        <input
                          value={newSubtask}
                          onChange={(e) => setNewSubtask(e.target.value)}
                          placeholder="Add a new engineering component..."
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                        />
                        <button
                          type="submit"
                          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 rounded-2xl transition-all border border-slate-700"
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                      </div>
                    </form>
                  </div>
                </section>

                {/* Integrated Work Log */}
                <section className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
                    <i className="fas fa-list-check text-indigo-500"></i> Transmission & Logs
                  </h4>

                  <form onSubmit={handleAddComment} className="flex gap-4">
                    <img src="https://ui-avatars.com/api/?name=Alex+Dev&background=6366f1&color=fff&bold=true" className="w-10 h-10 rounded-2xl border border-slate-800 shadow-lg" alt="" />
                    <div className="flex-1 space-y-3">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Append work note to the ledger..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-6 py-5 text-xs text-white focus:border-indigo-500 outline-none transition-all resize-none min-h-[120px] shadow-inner font-medium"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!newComment.trim()}
                          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-indigo-600/30 active:scale-95"
                        >
                          Commit Update
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="space-y-6 pt-4 border-t border-slate-800/30">
                    {selectedTask.comments?.map(comment => (
                      <div key={comment.id} className={`flex gap-4 animate-in slide-in-from-left-2 ${comment.isSystemLog ? 'opacity-60' : ''}`}>
                        {comment.isSystemLog ? (
                          <div className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                            <i className="fas fa-terminal text-[10px]"></i>
                          </div>
                        ) : (
                          <img src={comment.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user)}&background=6366f1&color=fff&bold=true`} className="w-10 h-10 rounded-2xl border border-slate-800 shadow-sm shrink-0" alt="" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${comment.isSystemLog ? 'text-indigo-400/80' : 'text-slate-200'}`}>
                              {comment.user}
                            </span>
                            <span className="text-[9px] font-black text-slate-700 uppercase">{comment.timestamp}</span>
                          </div>
                          <p className={`text-xs leading-relaxed ${comment.isSystemLog ? 'font-mono text-slate-500 italic' : 'text-slate-400 font-medium'}`}>
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Sidebar Metadata Pane */}
              <div className="w-full lg:w-[320px] p-6 sm:p-10 bg-slate-950/20 space-y-10 sm:space-y-12 lg:border-l border-slate-800/30">
                <section className="space-y-5">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Workflow State</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {(['todo', 'in-progress', 'completed'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateTaskStatus(selectedTask.id, status)}
                        className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] border transition-all relative overflow-hidden group ${selectedTask.status === status
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-600/40'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                      >
                        {selectedTask.status === status && (
                          <div className="absolute top-0 right-0 p-3 opacity-20 rotate-12">
                            <i className="fas fa-check-circle text-2xl"></i>
                          </div>
                        )}
                        <i className={`fas ${status === 'todo' ? 'fa-list-ul' : status === 'in-progress' ? 'fa-bolt-lightning' : 'fa-check-double'} mr-3`}></i>
                        {status.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-8 pt-8 border-t border-slate-800/50">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Assigned Resource</h4>
                    <div className="flex items-center gap-4 bg-slate-950/50 p-5 rounded-3xl border border-slate-800 shadow-inner">
                      {selectedTask.assigneeAvatar ? (
                        <img src={selectedTask.assigneeAvatar} className="w-11 h-11 rounded-2xl border border-slate-800 shadow-xl" alt="" />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-800 flex items-center justify-center text-indigo-400">
                          <i className="fas fa-user-circle text-xl"></i>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-100 truncate">{selectedTask.assignee}</p>
                        <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">Lead Engineer</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Agile Points</h4>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 5, 8].map(p => (
                          <button
                            key={p}
                            disabled
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black border transition-all ${selectedTask.points === p ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-700'
                              }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Deadline</h4>
                        <p className="text-xs font-mono font-bold text-slate-100 flex items-center gap-2">
                          <i className="far fa-calendar-alt text-indigo-500"></i> {selectedTask.dueDate || 'No Target'}
                        </p>
                      </div>
                      <div className="text-right">
                        <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Module ID</h4>
                        <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">{selectedTask.id}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Module Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.tags?.map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors cursor-default">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="pt-10">
                  <div className="p-6 bg-indigo-600/5 rounded-[2rem] border border-indigo-500/10 text-center shadow-inner relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                      <i className="fas fa-brain-circuit text-3xl"></i>
                    </div>
                    <i className="fas fa-network-wired text-indigo-400 text-xl mb-3 block animate-pulse"></i>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1.5">Neural Work Insight</p>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic group-hover:text-slate-400 transition-colors">
                      "Efficiency is optimized for {selectedTask.assignee}. Proceed with current subtask prioritization."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Task Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-[2.5rem] w-[95%] sm:w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="p-5 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-3 text-slate-100 tracking-tight uppercase">
                <i className="fas fa-code-merge text-indigo-400"></i> Provision Payload
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors bg-slate-800 rounded-full">
                <i className="fas fa-xmark text-sm sm:text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Task Nomenclature</label>
                <input required autoFocus value={newTaskForm.title} onChange={e => setNewTaskForm({ ...newTaskForm, title: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 ring-offset-0 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-white font-medium" placeholder="E.g. Neural Link Optimization" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Payload Specification</label>
                <textarea rows={3} value={newTaskForm.description} onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 ring-offset-0 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-white font-medium resize-none shadow-inner" placeholder="Detailed technical scope..." />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Associated Project</label>
                  <select required value={newTaskForm.projectId} onChange={e => setNewTaskForm({ ...newTaskForm, projectId: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none transition-all text-white cursor-pointer shadow-sm">
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Complexity (Pts)</label>
                  <select value={newTaskForm.points} onChange={e => setNewTaskForm({ ...newTaskForm, points: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none transition-all text-white cursor-pointer shadow-sm">
                    <option value="1">1 pt - Minor</option>
                    <option value="2">2 pts - Small</option>
                    <option value="3">3 pts - Standard</option>
                    <option value="5">5 pts - Significant</option>
                    <option value="8">8 pts - Complex</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Criticality</label>
                  <select value={newTaskForm.priority} onChange={e => setNewTaskForm({ ...newTaskForm, priority: e.target.value as any })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none transition-all text-white cursor-pointer">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Target Deadline</label>
                  <input type="date" value={newTaskForm.dueDate} onChange={e => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none transition-all text-white" />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4.5 border border-slate-800 rounded-3xl text-[11px] font-black text-slate-500 hover:bg-slate-800 transition-all uppercase tracking-[0.2em]">Discard</button>
                <button type="submit" className="flex-1 py-4.5 bg-indigo-600 hover:bg-indigo-700 rounded-3xl text-[11px] font-black shadow-2xl shadow-indigo-600/30 transition-all text-white uppercase tracking-[0.2em] active:scale-95">Commit Payload</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;
