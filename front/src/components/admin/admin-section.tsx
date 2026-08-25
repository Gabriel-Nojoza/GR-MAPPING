import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type AdminSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: { title: string; description: string; status: string }[];
};

export function AdminSection({ eyebrow, title, description, icon: Icon, items }: AdminSectionProps) {
  return <div className="mx-auto max-w-7xl">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-indigo-50 p-3 text-primary"><Icon size={23} /></div>
      <div><p className="text-sm font-medium text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    </div>
    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => <Card key={item.title} className="p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-800">{item.title}</h2><span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-primary">{item.status}</span></div><p className="mt-3 text-sm leading-6 text-slate-500">{item.description}</p></Card>)}
    </div>
  </div>;
}
