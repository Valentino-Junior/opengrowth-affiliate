import { AREA_ROLES, requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageTitle } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await requireRole(AREA_ROLES.admin);
  const settings = await getSettings();
  return (
    <>
      <PageTitle
        eyebrow="ADMIN"
        title="Settings"
        lead="Changes apply to the open week. Closed weeks keep the values they were calculated with."
      />
      <SettingsForm settings={settings} />
    </>
  );
}
