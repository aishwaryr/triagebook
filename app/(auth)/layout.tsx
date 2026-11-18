import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { getCurrentUser } from "@/lib/dal";

/** Reads the session, so navigations into this group wait for the server (no static shell). */
export const instant = false;

// Already signed in? /signin and /signup have nothing to offer — send them home.
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-6">
        <Brand className="justify-center text-lg" />
        {children}
      </div>
    </main>
  );
}
