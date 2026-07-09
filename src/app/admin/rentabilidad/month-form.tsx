"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MonthForm({ defaultMonth }: { defaultMonth: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/admin/rentabilidad?mes=${month}`);
      }}
      className="flex items-end gap-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="mes" className="text-xs text-muted-foreground">
          Mes
        </Label>
        <Input
          id="mes"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
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
