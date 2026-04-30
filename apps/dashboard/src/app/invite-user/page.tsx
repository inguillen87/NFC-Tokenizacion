import Link from "next/link";
import { Card } from "@product/ui";
import { InviteUserPanel } from "../../components/invite-user-panel";

export default async function InviteUserPage() {
  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-white">Invitar usuario</h1>
        <p className="mt-2 text-sm text-slate-400">Creá invitaciones reales con expiración y activación inicial.</p>
        <InviteUserPanel />
        <p className="mt-4 text-xs text-slate-400">También podés administrar usuarios desde <Link href="/users" className="text-cyan-300">/users</Link>.</p>
      </Card>
    </main>
  );
}
