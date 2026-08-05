"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bogotaMonthKey } from "@/lib/dates";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
].map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

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
  const [defaultYear, defaultMonthNum] = defaultMonth.split("-");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonthNum);

  // No debería haber datos en años futuros, así que el desplegable no los
  // ofrece: año actual (hora Bogotá, nunca new Date() crudo) y 2 anteriores.
  // Se incluye también el año de defaultMonth por si llega uno más viejo en
  // la URL, para que el <Select> nunca quede con un valor fuera de sus
  // opciones.
  const currentYear = Number(bogotaMonthKey().split("-")[0]);
  const years = Array.from(
    new Set([currentYear, currentYear - 1, currentYear - 2, Number(defaultYear)])
  ).sort((a, b) => b - a);

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Mes</Label>
        <Select key={defaultMonthNum} value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Año</Label>
        <Select key={defaultYear} value={year} onValueChange={setYear}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        onClick={() => {
          const params = new URLSearchParams({ mes: `${year}-${month}`, ...extraParams });
          router.push(`${basePath}?${params.toString()}`);
        }}
      >
        <Check className="h-4 w-4" />
        Aplicar
      </Button>
    </div>
  );
}
