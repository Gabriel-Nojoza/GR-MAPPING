import { type ReactNode } from "react";
import Link from "next/link";

export function SidebarContainer({ children }: { children: ReactNode }) {
  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-white">
      {children}
    </aside>
  );
}

export function SidebarHeader({ children }: { children: ReactNode }) {
  return (
    <div className="sidebar-brand flex h-32 items-center justify-center overflow-hidden border-b border-white/10 px-4 py-3">
      {children}
    </div>
  );
}

export function SidebarNav({ children }: { children: ReactNode }) {
  return <nav className="flex flex-1 flex-col gap-1 px-3 py-5">{children}</nav>;
}

export function SidebarItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
    >
      {active && (
        <span className="absolute left-0 h-5 w-1 -translate-x-3 rounded-r-full bg-indigo-400" />
      )}
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </Link>
  );
}

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="border-t border-white/10 p-3">{children}</div>;
}
