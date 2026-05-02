"use client";

import { Box, BrainCircuit, Factory, FileUp, Flame } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const navItems = [
  { href: "/" as Route, label: "3D Viewer", icon: Box, description: "IoT factory model" },
  { href: "/whr" as Route, label: "WHR Analysis", icon: Flame, description: "Track B heat recovery" },
  { href: "/documents" as Route, label: "Documents", icon: FileUp, description: "Extraction pipeline" },
  { href: "/chat" as Route, label: "AI Advisor", icon: BrainCircuit, description: "Energy intelligence" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <Factory size={19} strokeWidth={1.8} />
        </div>
        <div>
          <h1>ReTeqFusion</h1>
          <p>Industrial IoT Console</p>
        </div>
      </div>

      <nav className="nav-list" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              className={`nav-item${isActive ? " active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-badge">Re·Tech Fusion</div>
        <div className="sidebar-badge sidebar-badge--dim">Track A+B</div>
      </div>
    </aside>
  );
}
