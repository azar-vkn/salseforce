import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash } from "lucide-react";
import { GlassCard, Island, EmptyState } from "@/components/glass";
import { type Task } from "@/lib/types";
import { useTasks, useUpdateTask, useCreateTask, useDeleteTask } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — SalesMind AI" },
      { name: "description", content: "Kanban tasks for today, tomorrow and upcoming follow-ups." },
      { property: "og:title", content: "Tasks — SalesMind AI" },
      {
        property: "og:description",
        content: "Kanban tasks for today, tomorrow and upcoming follow-ups.",
      },
    ],
  }),
  component: TasksPage,
});

const columns: { id: Task["column"]; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

function TasksPage() {
  const { data: serverTasks = [], isLoading, error } = useTasks();
  const updateTaskMutation = useUpdateTask();
  const createTaskMutation = useCreateTask();
  const deleteTaskMutation = useDeleteTask();

  // Local state for optimistic updates during drag/drop
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Task["column"] | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    setTasks(serverTasks);
  }, [serverTasks]);

  function move(id: string, column: Task["column"]) {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, column } : t)));
    // Real update
    updateTaskMutation.mutate({ id, data: { column } });
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading tasks...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-red-500">Error loading tasks: {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm">Drag cards between columns</p>
        </div>
        <Island
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowAddForm(true)}
        >
          Add Task
        </Island>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col, i) => {
          const items = tasks.filter((t) => t.column === col.id);
          return (
            <GlassCard
              key={col.id}
              delay={i * 70}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={() => {
                if (dragId) move(dragId, col.id);
                setDragId(null);
                setOver(null);
              }}
              className={cn(
                "min-h-[16rem] transition-colors duration-300",
                over === col.id && "ring-primary/60 ring-2",
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <EmptyState
                  title="All clear"
                  description="Nothing scheduled here. Drop a task in or let AI plan your day."
                  action={
                    <Island variant="glass" className="text-xs" onClick={() => toast("AI planned your day")}>
                      Ask AI to plan
                    </Island>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      className="glass cursor-grab group relative rounded-[20px] p-3 transition hover:-translate-y-0.5 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{t.title}</p>
                        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingTask(t); }}
                            className="hover:bg-muted rounded p-1"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete task "${t.title}"?`)) {
                                deleteTaskMutation.mutate(t.id, {
                                  onSuccess: () => toast.success("Task deleted")
                                });
                              }
                            }}
                            className="hover:bg-red-500/10 rounded p-1"
                          >
                            <Trash className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="text-muted-foreground mt-2 flex items-center justify-between text-[11px]">
                        <span className="truncate">{t.lead}</span>
                        <span className="bg-primary/12 text-primary rounded-full px-2 py-0.5 font-semibold">
                          {t.tag}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Add/Edit Task Modal */}
      {(showAddForm || editingTask) ? (
        <TaskFormModal
          initialData={editingTask}
          onClose={() => {
            setShowAddForm(false);
            setEditingTask(null);
          }}
          onSave={(task) => {
            if (editingTask) {
              updateTaskMutation.mutate({ id: editingTask.id, data: task }, {
                onSuccess: () => {
                  toast.success("Task updated successfully!");
                  setEditingTask(null);
                },
                onError: (err) => {
                  toast.error(`Failed to update task: ${err.message}`);
                },
              });
            } else {
              createTaskMutation.mutate(task, {
                onSuccess: () => {
                  toast.success("Task added successfully!");
                  setShowAddForm(false);
                },
                onError: (err) => {
                  toast.error(`Failed to add task: ${err.message}`);
                },
              });
            }
          }}
          isSaving={createTaskMutation.isPending || updateTaskMutation.isPending}
        />
      ) : null}
    </div>
  );
}

// ── Task Form Modal ──────────────────────────────────────────────────
function TaskFormModal({
  initialData,
  onClose,
  onSave,
  isSaving,
}: {
  initialData: Task | null;
  onClose: () => void;
  onSave: (task: Omit<Task, "id">) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [lead, setLead] = useState(initialData?.lead || "");
  const [tag, setTag] = useState(initialData?.tag || "Task");
  const [column, setColumn] = useState<Task["column"]>(initialData?.column || "today");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      lead: lead.trim() || "Unassigned",
      tag: tag.trim() || "Task",
      column,
    });
  }

  const inputClass =
    "bg-background/60 focus:ring-ring/60 h-11 w-full rounded-[16px] px-4 text-sm outline-none focus:ring-2";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="glass rise w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[30px] p-6"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{initialData ? "Edit Task" : "Add New Task"}</h3>
          <button onClick={onClose} className="hover:bg-muted rounded-full p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow up with Acme Corp"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Lead</label>
            <input
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              placeholder="e.g. John Doe"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Tag</label>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. Call, Email, Meeting"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Column</label>
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value as Task["column"])}
              className={inputClass}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Island variant="glass" onClick={onClose}>
              Cancel
            </Island>
            <Island type="submit" disabled={isSaving || !title.trim()}>
              {isSaving ? "Saving…" : initialData ? "Save Changes" : "Add Task"}
            </Island>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
