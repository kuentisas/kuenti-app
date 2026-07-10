"use client";

import { useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { approveCorrectionAction, rejectCorrectionAction } from "./pending-actions";

export function CorrectionApprovalActions({ correctionId }: { correctionId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveCorrectionAction(correctionId);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
      } else {
        toast({ title: "Corrección aprobada", description: "El registro se actualizó." });
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectCorrectionAction(correctionId);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
      } else {
        toast({ title: "Corrección rechazada" });
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" variant="outline" disabled={isPending} className="gap-1.5" onClick={handleApprove}>
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Aprobar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        className="gap-1.5 text-destructive hover:text-destructive"
        onClick={handleReject}
      >
        <X className="h-3.5 w-3.5" />
        Rechazar
      </Button>
    </div>
  );
}
