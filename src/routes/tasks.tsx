import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { GlassCard, Island, EmptyState } from "@/components/glass";
import { initialTasks, type Task } from "@/lib/mock-data";
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
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Task["column"] | null>(null);

  function move(id: string, column: Task["column"]) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, column } : t)));
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
          onClick={() =>
            setTasks((p) => [
              { id: crypto.randomUUID(), title: "New follow-up", lead: "Unassigned", tag: "Task", column: "today" },
              ...p,
            ])
          }
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
                      className="glass cursor-grab rounded-[20px] p-3 transition hover:-translate-y-0.5 active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium">{t.title}</p>
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
    </div>
  );
}
