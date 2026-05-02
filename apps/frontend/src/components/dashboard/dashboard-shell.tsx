"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Box, FileUp, Factory } from "lucide-react";
import { useState } from "react";
import { DocumentUpload } from "./document-upload";
import { ThreeViewer } from "./three-viewer";

type Panel = "viewer" | "upload";

const navItems = [
  { id: "viewer" as const, label: "3D Viewer", icon: Box },
  { id: "upload" as const, label: "Upload Document", icon: FileUp },
];

const transitions = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -18 },
};

export function DashboardShell({ modelPath }: { modelPath: string }) {
  const [activePanel, setActivePanel] = useState<Panel>("viewer");

  return (
    <div className="app-shell">
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

        <nav className="nav-list" aria-label="Dashboard panels">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.id;

            return (
              <button
                className={`nav-item${isActive ? " active" : ""}`}
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                type="button"
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-panel">
        <section className="panel-frame">
          <AnimatePresence mode="wait">
            {activePanel === "viewer" ? (
              <motion.div
                animate="animate"
                className="viewer-panel"
                exit="exit"
                initial="initial"
                key="viewer"
                transition={{ duration: 0.24, ease: "easeOut" }}
                variants={transitions}
              >
                <ThreeViewer modelPath={modelPath} />
              </motion.div>
            ) : (
              <motion.div
                animate="animate"
                className="upload-panel"
                exit="exit"
                initial="initial"
                key="upload"
                transition={{ duration: 0.24, ease: "easeOut" }}
                variants={transitions}
              >
                <DocumentUpload />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
