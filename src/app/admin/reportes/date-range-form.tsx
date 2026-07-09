"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/admin/reportes?from=${from}&to=${to}`);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="from" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input
          id="from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to" className="text-xs text-muted-foreground">
          Hasta
        </Label>
        <Input
          id="to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
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
