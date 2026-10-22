import type { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const AREA: Record<Role, "affiliate" | "desk" | "ops" | "admin"> = { affiliate: "affiliate", employee: "desk", ops: "ops", admin: "admin" };

/** My profile: every signed-in person, inside their own role's menu. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["affiliate", "employee", "ops", "admin"]);
  return (
    <AppShell area={AREA[user.role]} user={user}>
      {children}
    </AppShell>
  );
}
