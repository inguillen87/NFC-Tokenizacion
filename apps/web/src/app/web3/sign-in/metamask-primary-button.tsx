"use client";

import { SignInWithMetamaskButton } from "@clerk/nextjs";
import { WalletCards } from "lucide-react";

export function MetamaskPrimaryButton({ redirectUrl }: { redirectUrl: string }) {
  return (
    <SignInWithMetamaskButton redirectUrl={redirectUrl}>
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.2)] transition hover:bg-cyan-200"
        title="Firmar con MetaMask y volver al Passport nexID."
      >
        <WalletCards className="h-4 w-4" aria-hidden="true" />
        Firmar con MetaMask
      </button>
    </SignInWithMetamaskButton>
  );
}
