"use client";

import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DateRangeForm({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        router.push(`/admin/reportes?from=${from}&to=${to}`);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="from" className="text-xs text-muted-foreground">
          Desde
        </Label>
        {/* No controlado, mismo motivo que MonthForm: un input type="date"
            controlado por React puede pelear con el widget nativo mientras
            se escriben dígitos, dejando el valor pegado en el original. */}
        <Input
          key={defaultFrom}
          id="from"
          name="from"
          type="date"
          defaultValue={defaultFrom}
          className="w-40"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to" className="text-xs text-muted-foreground">
          Hasta
        </Label>
        <Input
          key={defaultTo}
          id="to"
          name="to"
          type="date"
          defaultValue={defaultTo}
          className="w-40"
        />
      </div>
      <Button type="submit" variant="secondary" className="gap-2">
        <Filter className="h-4 w-4" />
        Filtrar
      </Button>
    </form>
  );
}
