import type { ReactNode } from "react";

import { Navbar } from "@/components/navbar";
import { requireUser } from "@/lib/dal";

/** Reads the session, so navigations into this group wait for the server (no static shell). */
export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}
