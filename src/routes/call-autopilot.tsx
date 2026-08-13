import { createFileRoute } from "@tanstack/react-router";
import { Island } from "@/components/glass";

export const Route = createFileRoute("/call-autopilot")({
  head: () => ({
    meta: [
      { title: "Call Autopilot — SalesMind AI" },
      { name: "description", content: "AI Voice Agent Configuration" },
    ],
  }),
  component: CallAutopilotPlaceholder,
});

function CallAutopilotPlaceholder() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Call Autopilot (Voice)</h2>
      </div>
      <Island className="p-8 text-center max-w-2xl mx-auto mt-12">
        <h3 className="text-xl font-semibold mb-2">Voice AI Coming Soon</h3>
        <p className="text-muted-foreground">
          The Call Autopilot voice integration module is currently under development. 
          Check back later for full AI voice calling capabilities.
        </p>
      </Island>
    </div>
  );
}
