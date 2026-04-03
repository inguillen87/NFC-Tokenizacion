import Link from "next/link";
import { Button, Card } from "@product/ui";

export default async function InviteUserPage() {
  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-white">Invitar usuario</h1>
        <p className="mt-2 text-sm text-slate-400">La gestión de usuarios ahora vive en el workspace protegido de IAM.</p>
        <Link href="/users"><Button className="mt-6 w-full">Abrir gestión de usuarios</Button></Link>
      </Card>
    </main>
  );
}
