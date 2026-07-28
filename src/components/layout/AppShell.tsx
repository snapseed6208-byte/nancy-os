import type { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-cream">
      <Sidebar />
      <main className="lg:pl-60 pt-16 lg:pt-0">
        <div className="mx-auto max-w-2xl px-4 py-6 lg:py-8 safe-bottom">
          {children}
        </div>
      </main>
    </div>
  );
}
