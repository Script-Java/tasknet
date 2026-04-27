import { useEffect, useState, useCallback, useMemo } from 'react';
import { NaturalInput } from '../components/NaturalInput';
import { TaskForm } from '../components/TaskForm';
import { getAll, initDB, deleteRecord, upsertRecord } from '../lib/store';
import { syncWithSupabase } from '../lib/sync';
import { gamification, getTaskXp, getTaskCoins } from '../lib/gamification';
import { buildBadgeContext, evaluateBadges, unlockBadges, saveBadgeProgress } from '../lib/badgeEvaluator';
import { useBadgeContext } from '../contexts/BadgeContext';
import type { Task } from '../lib/types';
import { Trash2, RefreshCw, Star, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export function TasksPage({ userId }: { userId: string }) {
  const { showBadge } = useBadgeContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    await initDB();
    const localTasks = await getAll('tasks') as Task[];
    setTasks(localTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }, []);

  useEffect(() => {
    loadData();
    gamification.markOverdueTasks(userId).catch(() => {});
  }, [userId, loadData]);

  const activeTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithSupabase();
      await loadData();
      toast.success('Synced with cloud');
      await runBadgeCheck('manual');
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const runBadgeCheck = async (
    trigger: 'task_complete' | 'habit_complete' | 'manual',
    opts?: Parameters<typeof buildBadgeContext>[2]
  ) => {
    try {
      const ctx = await buildBadgeContext(userId, trigger, opts);
      const result = await evaluateBadges(ctx);
      if (result.unlocked.length > 0) {
        await unlockBadges(userId, result.unlocked);
        for (const badgeId of result.unlocked) {
          showBadge(badgeId);
        }
      }
      if (Object.keys(result.progressUpdates).length > 0) {
        await saveBadgeProgress(userId, result.progressUpdates);
      }
    } catch (e) {
      console.error('Badge check failed:', e);
    }
  };

  const toggleTaskCompletion = async (task: Task) => {
    const wasCompleted = task.completed;

    if (!wasCompleted) {
      try { await syncWithSupabase(); } catch {}
    }

    const updatedTask = {
      ...task,
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    };
    await upsertRecord('tasks', updatedTask);
    await loadData();

    if (!wasCompleted && updatedTask.completed) {
      const xpEarned = getTaskXp(task.priority);
      const coinsEarned = getTaskCoins(task.priority);
      toast.success(`Task completed! +${xpEarned} XP, +${coinsEarned} coin${coinsEarned !== 1 ? 's' : ''}`, { icon: '🎉' });
      try {
        await gamification.completeTask(task.id);
        await runBadgeCheck('task_complete', {
          xpDelta: xpEarned,
          lastAction: { type: 'task', id: task.id, completedAt: new Date() },
        });
      } catch {
      }
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!task.completed) {
      if (!confirm('Delete this task?')) return;
      await deleteRecord('tasks', task.id);
      await loadData();
      toast.success('Task deleted');
      return;
    }
    setDeleteTarget(task);
  };

  const confirmDeleteCompleted = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await gamification.deleteTaskAndRevokeXp(deleteTarget.id);
      await deleteRecord('tasks', deleteTarget.id);
      await loadData();
      toast.success('Task deleted. XP and coins revoked.', { icon: '🗑️' });
    } catch {
      toast.error('Failed to delete task. Try syncing first.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const priorityLabels: Record<string, { label: string; xp: number; coins: number }> = {
    low: { label: 'Low', xp: 5, coins: 1 },
    medium: { label: 'Medium', xp: 10, coins: 2 },
    high: { label: 'High', xp: 15, coins: 3 },
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#EEEEF8]">Tasks</h1>
          <p className="text-[#8E89B3] mt-1 md:mt-2 text-base md:text-lg">Manage your todos and get things done.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-[rgba(21,18,42,0.75)] border border-[#2A2545] rounded-xl text-sm font-semibold text-[#8E89B3] hover:bg-[rgba(30,26,58,0.75)] transition shadow-sm disabled:opacity-50 backdrop-blur-md self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#A78BFA]' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>

      <div>
        <NaturalInput userId={userId} onSaved={loadData} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
        <div className="order-2 xl:order-1">
          <TaskForm userId={userId} onSaved={loadData} />
        </div>

        <div className="order-1 xl:order-2 space-y-4 md:space-y-8">
          {/* Active Tasks */}
          <div className="galaxy-card p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center justify-between text-[#EEEEF8]">
              Active Tasks
              <span className="bg-[rgba(100,181,246,0.2)] text-[#64B5F6] py-0.5 px-2.5 rounded-full text-sm font-medium">
                {activeTasks.length}
              </span>
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {activeTasks.map(task => (
                <div key={task.id} className={`group flex items-center justify-between p-3 md:p-4 bg-[rgba(13,11,30,0.4)] rounded-2xl border transition-colors ${task.overdue ? 'border-[rgba(239,83,80,0.3)]' : 'border-[#2A2545] hover:border-[rgba(139,92,246,0.3)]'}`}>
                  <div className="flex items-center space-x-3 md:space-x-4 overflow-hidden min-w-0">
                    <button onClick={() => toggleTaskCompletion(task)} className="galaxy-check flex-shrink-0">
                    </button>
                    <div className="min-w-0">
                      <p className="font-medium text-[#EEEEF8] truncate">{task.title}</p>
                      <p className="text-xs text-[#5C5780] mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>{task.duration}m</span>
                        <span className="w-1 h-1 bg-[#2A2545] rounded-full hidden sm:inline-block"></span>
                        <span className={`capitalize ${task.priority === 'high' ? 'text-[#EF5350]' : task.priority === 'medium' ? 'text-[#FFB74D]' : 'text-[#66BB6A]'}`}>{task.priority}</span>
                        {task.overdue && (
                          <>
                            <span className="w-1 h-1 bg-[#2A2545] rounded-full hidden sm:inline-block"></span>
                            <span className="text-[#EF5350] font-medium">Overdue</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTask(task)} className="sm:opacity-0 sm:group-hover:opacity-100 p-2 text-[#5C5780] hover:text-[#EF5350] transition-all flex-shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {activeTasks.length === 0 && (
                <p className="text-[#5C5780] text-center py-8">No active tasks. You're all caught up!</p>
              )}
            </div>
          </div>

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="galaxy-card p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center justify-between text-[#EEEEF8]">
                Completed
                <span className="bg-[rgba(102,187,106,0.2)] text-[#66BB6A] py-0.5 px-2.5 rounded-full text-sm font-medium">
                  {completedTasks.length}
                </span>
              </h3>
              <div className="space-y-2">
                {completedTasks.slice(0, 5).map(task => (

                    <div key={task.id} className="group flex items-center justify-between p-3 bg-[rgba(13,11,30,0.4)] rounded-xl opacity-50">
                      <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1">
                        <div className="galaxy-check checked flex-shrink-0">
                          <Star className="w-3.5 h-3.5 text-white" />
                        </div>
                        <p className="text-sm text-[#8E89B3] line-through truncate">{task.title}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteTask(task)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[#EF5350]/60 hover:text-[#EF5350] hover:bg-[rgba(239,83,80,0.1)] rounded-lg transition-all flex-shrink-0"
                        title="Delete completed task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Completed Task Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(6, 4, 15, 0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-3xl border p-8 text-center overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #1C1836 0%, #0F0D22 100%)',
                borderColor: 'rgba(239, 83, 80, 0.3)',
                boxShadow: '0 0 40px rgba(239, 83, 80, 0.1), 0 20px 40px rgba(0,0,0,0.5)',
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{
                  background: 'linear-gradient(90deg, transparent, #EF5350, #FF6B6B, transparent)',
                }}
              />

              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(239, 83, 80, 0.12)' }}>
                <AlertTriangle className="w-7 h-7 text-[#EF5350]" />
              </div>

              <h3 className="text-xl font-black tracking-tight text-[#EEEEF8] mb-2">
                Delete Completed Task?
              </h3>

              <p className="text-[#8E89B3] text-sm leading-relaxed mb-2">
                Are you sure? Deleting a completed task will <strong className="text-[#EF5350]">permanently remove</strong> the XP and coins you earned from it.
              </p>

              {(() => {
                const d = priorityLabels[deleteTarget.priority] || priorityLabels.medium;
                return (
                  <div className="inline-flex items-center gap-3 mb-6 px-4 py-2 rounded-xl bg-[rgba(239,83,80,0.08)] border border-[rgba(239,83,80,0.2)]">
                    <span className="text-xs font-semibold text-[#EF5350]">-{d.xp} XP</span>
                    <span className="w-1 h-1 rounded-full bg-[#EF5350]/30" />
                    <span className="text-xs font-semibold text-[#FFB74D]">-{d.coins} coin{d.coins !== 1 ? 's' : ''}</span>
                    <span className="w-1 h-1 rounded-full bg-[#EF5350]/30" />
                    <span className="text-xs text-[#8E89B3]">{d.label} priority</span>
                  </div>
                );
              })()}

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#2A2545] text-sm font-semibold text-[#8E89B3] hover:bg-[rgba(255,255,255,0.04)] transition"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCompleted}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white transition"
                  style={{
                    background: isDeleting
                      ? 'rgba(239,83,80,0.3)'
                      : 'linear-gradient(135deg, #EF5350 0%, #E53935 100%)',
                    boxShadow: '0 4px 20px rgba(239, 83, 80, 0.3)',
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete & Revoke XP'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
