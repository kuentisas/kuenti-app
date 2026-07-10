"use client";

import { useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { approveActivity, rejectActivity } from "./pending-actions";

export function ActivityApprovalActions({ activityId }: { activityId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handle(action: (id: string) => Promise<{ error: string | null }>, successTitle: string) {
    startTransition(async () => {
      const result = await action(activityId);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
      } else {
        toast({ title: successTitle });
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        className="gap-1.5"
        onClick={() => handle(approveActivity, "Actividad aprobada")}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Aprobar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        className="gap-1.5 text-destructive hover:text-destructive"
        onClick={() => handle(rejectActivity, "Actividad rechazada")}
      >
        <X className="h-3.5 w-3.5" />
        Rechazar
      </Button>
    </div>
  );
}
