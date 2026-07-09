"use client";

import { useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { toggleClientActivo } from "./actions";

export function ActivoSwitch({
  clientId,
  activo,
}: {
  clientId: string;
  activo: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <Switch
      checked={activo}
      disabled={isPending}
      onCheckedChange={(checked) => {
        startTransition(async () => {
          const result = await toggleClientActivo(clientId, checked);
          if (result.error) {
            toast({ variant: "destructive", title: "Error", description: result.error });
          }
        });
      }}
    />
  );
}
