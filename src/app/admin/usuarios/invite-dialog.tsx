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
import { generatePassword } from "@/lib/generate-password";
import type { Role } from "@/types/database";
import { createTeamMember } from "./actions";

// callerRole decide qué puede ofrecer el selector de rol: un supervisor
// solo puede crear miembros del equipo (ni siquiera se le muestra el
// selector, para que quede claro que no hay otra opción — el server
// además lo fuerza en createTeamMember por las dudas). Un admin puede
// crear cualquier rol.
export function InviteDialog({ callerRole }: { callerRole: Role }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("colaboradora");
  const [password, setPassword] = useState(() => generatePassword());
  const [debeCambiarPassword, setDebeCambiarPassword] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const canChooseRole = callerRole === "admin";

  function resetAndClose() {
    setOpen(false);
    setCreatedEmail(null);
    setCopied(false);
    setPassword(generatePassword());
    setDebeCambiarPassword(true);
    setRole("colaboradora");
  }

  function handleSubmit(formData: FormData) {
    formData.set("role", canChooseRole ? role : "colaboradora");
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
              {canChooseRole ? (
                <div className="space-y-1.5">
                  <Label>Rol</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaboradora">Miembro del equipo</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin (gerente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Rol</Label>
                  <p className="text-sm text-muted-foreground">Miembro del equipo</p>
                </div>
              )}
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
