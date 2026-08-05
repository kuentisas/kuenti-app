"use client";

import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MonthForm({
  defaultMonth,
  basePath,
  extraParams,
}: {
  defaultMonth: string;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const month = new FormData(e.currentTarget).get("mes") as string;
        const params = new URLSearchParams({ mes: month, ...extraParams });
        router.push(`${basePath}?${params.toString()}`);
      }}
      className="flex items-end gap-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="mes" className="text-xs text-muted-foreground">
          Mes
        </Label>
        {/* No controlado (defaultValue, no value/onChange): un input type="month"
            controlado por React puede "pelear" con el widget nativo del navegador
            mientras el usuario escribe dígitos, dejando el estado pegado en el
            valor original — bug real reportado (Filtrar no hacía nada al escribir
            un mes nuevo). key=defaultMonth fuerza reinicializar el valor si el
            mes por defecto cambia desde el servidor (ej. navegación externa). */}
        <Input
          key={defaultMonth}
          id="mes"
          name="mes"
          type="month"
          defaultValue={defaultMonth}
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
