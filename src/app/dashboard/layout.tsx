import { AREA_ROLES, requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(AREA_ROLES.affiliate);
  return (
    <AppShell area="affiliate" user={user}>
      {children}
    </AppShell>
  );
}
