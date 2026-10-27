"use client";

import { useState } from "react";
import { Field } from "@/components/field";
import { Select } from "@/components/select";

type Role = "employee" | "ops" | "admin";

// The Add staff fields. Picking a role fills in the next free code for it; it can still be changed.

export function StaffFields({ suggested }: { suggested: Record<Role, string> }) {
  const [code, setCode] = useState("");
  return (
    <>
      <Select
        label="Role"
        name="role"
        required
        placeholder="Choose a role"
        options={[
          { value: "employee", label: "Desk employee: adds players, logs and verifies money" },
          { value: "ops", label: "Ops manager: payouts, IDs, flags, affiliates" },
          { value: "admin", label: "Admin: all ops work, plus Staff and Settings" },
        ]}
        onChange={(e) => setCode(suggested[e.target.value as Role] ?? "")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required />
        <Field
          label="Code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Filled in when you pick a role"
          maxLength={4}
          hint="Their tag on every entry they log or verify. Filled in for you; change it only if you want to."
        />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone number" name="phone" type="tel" required />
      </div>
    </>
  );
}
