import { Sidebar } from "@product/ui";
import { Topbar } from "../_components/topbar";

const items = [
  { href: "/", label: "Overview" },
  { href: "/batches", label: "Batches" },
  { href: "/analytics", label: "Analytics" },
  { href: "/events", label: "Events" },
  { href: "/resellers", label: "Resellers" },
  { href: "/billing", label: "Plans" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white lg:flex">
      <Sidebar title="Platform ops" items={items} />
      <div className="min-w-0 flex-1">
        <Topbar />
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
