"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export type TabItem = { href: string; icon: LucideIcon; label: string };

export function MobileTabBar({ items, onMais }: { items: TabItem[]; onMais: () => void }) {
  const pathname = usePathname();
  const ativo = (href: string) => (href === "/" || href === "/eng" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <nav className="pointer-events-auto flex w-full max-w-md items-stretch justify-between gap-1 rounded-[28px] bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
        {items.slice(0, 4).map((item) => {
          const on = ativo(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-[20px] px-1 py-2 text-[11px] font-medium transition-colors ${
                on ? "bg-primary text-white" : "text-slate-500"
              }`}
            >
              <item.icon size={20} strokeWidth={on ? 2.4 : 2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMais}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-[20px] px-1 py-2 text-[11px] font-medium text-slate-500"
        >
          <MoreHorizontal size={20} />
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
