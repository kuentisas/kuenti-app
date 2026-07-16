"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__todas__";

// A diferencia de ColaboradoraSelect (calendario admin), acá "todas" es
// una opción válida y es el valor por defecto — este filtro es opcional,
// no una vista que siempre requiera una colaboradora puntual.
export function AdjustmentsColaboradoraSelect({
  colaboradoras,
  selectedId,
}: {
  colaboradoras: { id: string; nombre: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_VALUE) {
      params.delete("colaborador");
    } else {
      params.set("colaborador", value);
    }
    router.push(`/admin?${params.toString()}`);
  }

  return (
    <Select value={selectedId || ALL_VALUE} onValueChange={handleChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Todas las colaboradoras" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>Todas las colaboradoras</SelectItem>
        {colaboradoras.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
