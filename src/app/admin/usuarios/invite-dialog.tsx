"use client";

import { useState, useTransition } from "react";
import { Loader2, UserPlus, RefreshCw, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { createTeamMember } from "./actions";

// Sin 0/O/1/l/I para que sea fácil de leer y transcribir al compartirla.
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";

function generatePassword(length = 12) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => PASSWORD_CHARS[v % PASSWORD_CHARS.length]).join("");
}

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("colaboradora");
  const [password, setPassword] = useState(() => generatePassword());
  const [debeCambiarPassword, setDebeCambiarPassword] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function resetAndClose() {
    setOpen(false);
    setCreatedEmail(null);
    setCopied(false);
    setPassword(generatePassword());
    setDebeCambiarPassword(true);
    setRole("colaboradora");
  }

  function handleSubmit(formData: FormData) {
    formData.set("role", role);
    formData.set("password", password);
    formData.set("debeCambiarPassword", String(debeCambiarPassword));
    const email = String(formData.get("email") ?? "");
    startTransition(async () => {
      const result = await createTeamMember(formData);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      setCreatedEmail(email);
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Agregar miembro
        </Button>
      </DialogTrigger>
      <DialogContent>
        {createdEmail ? (
          <>
            <DialogHeader>
              <DialogTitle>Cuenta creada</DialogTitle>
              <DialogDescription>
                Comparte esta contraseña temporal con {createdEmail} por un canal seguro (no
                por acá). No podrás volver a verla después de cerrar esta ventana.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-secondary/40 px-3 py-2">
              <code className="flex-1 font-mono text-sm">{password}</code>
              <Button type="button" variant="ghost" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={resetAndClose}>
                Listo
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nuevo miembro del equipo</DialogTitle>
              <DialogDescription>
                Le asignas una contraseña temporal directamente — no depende de que le llegue
                un correo.
              </DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input id="nombre" name="nombre" required placeholder="María Pérez" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" required placeholder="maria@kuenti.co" />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaboradora">Miembro del equipo</SelectItem>
                    <SelectItem value="admin">Admin (gerente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña temporal</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setPassword(generatePassword())}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="debe_cambiar"
                  checked={debeCambiarPassword}
                  onCheckedChange={(checked) => setDebeCambiarPassword(checked === true)}
                />
                <Label htmlFor="debe_cambiar" className="text-sm font-normal">
                  Pedir que cambie la contraseña al iniciar sesión por primera vez
                </Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending} className="gap-2">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear cuenta
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
