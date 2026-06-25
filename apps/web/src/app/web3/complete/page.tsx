import { Web3CompleteClient } from "./web3-complete-client";

export default async function Web3CompletePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const nextPath = typeof params.next === "string" ? params.next : "/me/wallet";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(124,58,237,.16),transparent_30%)]" />
      <div className="relative z-10 w-full">
        <Web3CompleteClient nextPath={nextPath} />
      </div>
    </main>
  );
}
