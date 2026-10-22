import { AREA_ROLES, requireRole } from "@/lib/auth";
import { formatRate } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { HowItWorksSections } from "@/components/how-it-works";
import { PageTitle } from "@/components/ui";

// The program explained, inside the affiliate's account (same content as the public home page).
export default async function AffiliateHowItWorksPage() {
  await requireRole(AREA_ROLES.affiliate);
  const settings = await getSettings();
  return (
    <>
      <PageTitle
        eyebrow="AFFILIATE DASHBOARD"
        title="How it works"
        lead={`You earn ${formatRate(settings.commissionRateBp)} of your players' gross profit, paid every Monday. Here are the full rules.`}
      />
      <div className="flex flex-col gap-20 pt-4">
        <HowItWorksSections settings={settings} />
      </div>
    </>
  );
}
