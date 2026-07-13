"use client";

import { useState, useTransition } from "react";
import { Loader2, KeyRound, RefreshCw, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { resetUserPassword } from "./actions";

export function ResetPasswordDialog({ userId, nombre }: { userId: string; nombre: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(() => generatePassword());
  const [debeCambiarPassword, setDebeCambiarPassword] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function resetAndClose() {
    setOpen(false);
    setDone(false);
    setCopied(false);
    setPassword(generatePassword());
    setDebeCambiarPassword(true);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await resetUserPassword(userId, password, debeCambiarPassword);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      setDone(true);
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
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Restablecer contraseña">
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>Contraseña restablecida</DialogTitle>
              <DialogDescription>
                Comparte esta contraseña temporal con {nombre} por un canal seguro (no por
                acá). No podrás volver a verla después de cerrar esta ventana.
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
              <DialogTitle>Restablecer contraseña de {nombre}</DialogTitle>
              <DialogDescription>
                Le asignas una contraseña temporal nueva. Sirve tanto si la olvidó como si una
                cuenta creada antes nunca llegó a tener una utilizable.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset_password">Contraseña temporal</Label>
                <div className="flex gap-2">
                  <Input
                    id="reset_password"
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
                  id="reset_debe_cambiar"
                  checked={debeCambiarPassword}
                  onCheckedChange={(checked) => setDebeCambiarPassword(checked === true)}
                />
                <Label htmlFor="reset_debe_cambiar" className="text-sm font-normal">
                  Pedir que cambie la contraseña al iniciar sesión
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" disabled={isPending} className="gap-2" onClick={handleSubmit}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Restablecer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
