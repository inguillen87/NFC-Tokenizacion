const rows = [
  ["BODEGA-01", "VALID", "AR-MDZ", "14:21:09"],
  ["BODEGA-01", "VALID", "AR-MDZ", "14:21:42"],
  ["COSM-12", "REPLAY_SUSPECT", "BR-SAO", "14:22:10"],
  ["RESELLER-03", "NOT_ACTIVE", "AR-CBA", "14:22:59"],
];

export function EventTable() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-slate-400">
          <tr>
            <th className="px-4 py-3">Tenant</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3">Geo</th>
            <th className="px-4 py-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")} className="border-b border-white/5">
              {row.map((cell) => <td key={cell} className="px-4 py-3 text-slate-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
