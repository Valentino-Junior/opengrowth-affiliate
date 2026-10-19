"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsState } from "@/app/actions/settings";
import type { Settings } from "@/lib/settings";
import { Button, Card } from "@/components/ui";
import { Field } from "@/components/field";

const dollars = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  return (
    <form action={action} className="flex flex-col gap-6">
      <Card className="grid gap-4 sm:grid-cols-3">
        <h2 className="m-0 text-xl font-extrabold sm:col-span-3">Payouts</h2>
        <Field label="Commission rate (%)" name="ratePercent" inputMode="decimal" defaultValue={settings.commissionRateBp / 100} required />
        <Field label="Minimum payout ($)" name="minPayout" inputMode="decimal" defaultValue={dollars(settings.minPayoutCents)} required />
        <Field
          label="ID check over ($)"
          name="idThreshold"
          inputMode="decimal"
          defaultValue={dollars(settings.idThresholdCents)}
          hint="Payouts above this need a verified ID"
          required
        />
      </Card>

      <Card className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-4">
          <h2 className="m-0 text-xl font-extrabold">Status badges</h2>
          <p className="m-0 mt-1 text-sm text-muted">Minimum earned last month to show each badge. Recognition only.</p>
        </div>
        {settings.badgeThresholds.map((b, i) => (
          <Field key={b.name} label={`${b.name} ($)`} name={`badge${i}`} inputMode="decimal" defaultValue={dollars(b.minCents)} required />
        ))}
      </Card>

      <Card className="grid gap-4 sm:grid-cols-3">
        <h2 className="m-0 text-xl font-extrabold sm:col-span-3">Top 3 race and links</h2>
        <Field label="1st place prize" name="prize1" defaultValue={settings.prizes.first} required />
        <Field label="2nd place prize" name="prize2" defaultValue={settings.prizes.second} required />
        <Field label="3rd place prize" name="prize3" defaultValue={settings.prizes.third} required />
        <div className="sm:col-span-3">
          <Field label="Group chat link" name="groupChatUrl" type="url" placeholder="https://" defaultValue={settings.groupChatUrl} />
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state.error ? <span role="alert" className="text-sm text-orange">{state.error}</span> : null}
        {state.saved ? <span role="status" className="text-sm text-green">Saved.</span> : null}
      </div>
    </form>
  );
}
