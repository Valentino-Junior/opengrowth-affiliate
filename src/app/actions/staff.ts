"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { attempt, type ActionState } from "@/lib/errors";
import { ROLE_LABEL } from "@/lib/labels";
import { STAFF_ROLES, createStaff, resetStaffPassword, setStaffActive } from "@/lib/staff";

const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

const staffSchema = z.object({
  role: z.enum(STAFF_ROLES as [string, ...string[]], { message: "Choose a role" }),
  name: z.string().min(2, "Enter their name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a full phone number"),
  code: z.union([z.literal(""), z.string().regex(/^[A-Za-z0-9]{2,4}$/, "The code is 2 to 4 letters or numbers, like A4")]),
});

export async function createStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireRole(AREA_ROLES.admin);
  const parsed = staffSchema.safeParse({
    role: str(form, "role"),
    name: str(form, "name"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    code: str(form, "code"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return attempt(async () => {
    const { email, password } = await createStaff({ ...d, role: d.role as (typeof STAFF_ROLES)[number] }, admin.id);
    revalidatePath("/admin/staff");
    return {
      message: `${d.name} can log in as ${ROLE_LABEL[d.role as (typeof STAFF_ROLES)[number]].toLowerCase()}. Give them these details; they change the password on their profile.`,
      detail: { "Login email": email, "Temporary password": password },
    };
  });
}

export async function resetStaffPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireRole(AREA_ROLES.admin);
  return attempt(async () => {
    const { email, password } = await resetStaffPassword(str(form, "userId"), admin.id);
    return { message: "Done. Their old password no longer works.", detail: { "Login email": email, "Temporary password": password } };
  });
}

export async function setStaffActiveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireRole(AREA_ROLES.admin);
  return attempt(async () => {
    await setStaffActive(str(form, "userId"), form.get("active") === "true", admin.id);
    revalidatePath("/admin/staff");
  });
}
