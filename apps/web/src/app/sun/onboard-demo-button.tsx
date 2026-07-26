export function OnboardDemoButton({ bid }: { bid: string }) {
  return (
    <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3">
      <p className="text-xs text-cyan-100">
        El batch {bid} todavía no está provisionado. El alta es una operación administrativa protegida; solicitála al equipo nexID.
      </p>
    </div>
  );
}
