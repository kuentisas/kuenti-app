import Image from "next/image";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

export default function CambiarPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-kuenti-bg p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <Image
            src="/logo.png"
            alt="Kuenti"
            width={548}
            height={164}
            className="mx-auto mb-2 h-14 w-auto"
            priority
          />
          <CardTitle className="sr-only">Kuenti</CardTitle>
          <CardDescription>
            Tu administrador te asignó una contraseña temporal. Elige una nueva antes de
            continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
