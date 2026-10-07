"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const sections = [
  { href: "/private-memory", label: "Overview" },
  { href: "/private-memory/edit", label: "Edit Assets" },
  { href: "/private-memory/history", label: "Change History" },
  { href: "/auth/status", label: "Account" },
];

export default function PrivateMemoryLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <>
    <div className="workspaceNavWrap">
      <nav className="workspaceNav" aria-label="Private workspace navigation">
        <Link className="workspaceBrand" href="/">KAIKOA OS</Link>
        <div className="workspaceNavLinks">
          {sections.map(({href,label}) => <Link key={href} href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={pathname === href ? "workspaceNavLink active" : "workspaceNavLink"}>{label}</Link>)}
        </div>
      </nav>
    </div>
    {children}
  </>;
}
