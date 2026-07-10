"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ColaboradoraSelect({
  colaboradoras,
  selectedId,
}: {
  colaboradoras: { id: string; nombre: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(userId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("colaboradora", userId);
    router.push(`/admin/calendario?${params.toString()}`);
  }

  return (
    <Select value={selectedId} onValueChange={handleChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Selecciona un miembro del equipo" />
      </SelectTrigger>
      <SelectContent>
        {colaboradoras.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
