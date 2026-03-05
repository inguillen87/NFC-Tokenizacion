import Link from "next/link";
import { Badge, Card } from "@product/ui";

export function ModuleGrid({ modules, actionLabel }: { modules: Array<{ title: string; description: string; href: string; status: string; tone?: "green" | "amber" | "default" }>; actionLabel: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => (
        <Card key={module.title} className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{module.title}</h3>
            <Badge tone={module.tone ?? "default"}>{module.status}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-400">{module.description}</p>
          <Link href={module.href} className="mt-4 inline-flex text-xs font-semibold uppercase tracking-wide text-cyan-300">
            {actionLabel}
          </Link>
        </Card>
      ))}
    </div>
  );
}
