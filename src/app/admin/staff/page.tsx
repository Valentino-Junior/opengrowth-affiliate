import { createStaffAction, resetStaffPasswordAction, setStaffActiveAction } from "@/app/actions/staff";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { STAFF_ROLES } from "@/lib/staff";
import { ActionForm } from "@/components/action-form";
import { ModalButton } from "@/components/modal-button";
import { Field } from "@/components/field";
import { Select } from "@/components/select";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageTitle, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";

export const metadata = { title: "Staff · Opengrowth" };

const ROLE_TONE = { employee: "blue", ops: "gold", admin: "green" } as const;

export default async function StaffPage() {
  const me = await requireRole(AREA_ROLES.admin);
  const staff = await db.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    include: { staff: true },
    orderBy: [{ status: "asc" }, { role: "desc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageTitle eyebrow="ADMIN" title="Staff" lead="Everyone who logs in to the desk or ops. Turning someone off logs them out straight away." />
        <ModalButton label="Add staff" title="Add a staff login" description="They get a temporary password to change on their profile.">
          <ActionForm action={createStaffAction} resetOnSuccess className="flex flex-col gap-4">
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
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" required />
              <Field label="Code" name="code" placeholder="A4" maxLength={4} required hint="Their short tag on every entry they log or verify, like A1. Must be unique." />
              <Field label="Email" name="email" type="email" required />
              <Field label="Phone number" name="phone" type="tel" required />
            </div>
            <div>
              <SubmitButton pendingText="Creating…">Create login</SubmitButton>
            </div>
          </ActionForm>
        </ModalButton>
      </div>

      <Card className="!px-0 !pt-2">
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th>Role</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? <EmptyRow cols={7}>No staff yet.</EmptyRow> : null}
            {staff.map((u) => {
              const name = u.staff?.displayName ?? u.email;
              const active = u.status === "active";
              return (
                <tr key={u.id} className={active ? "" : "opacity-60"}>
                  <Td className="font-semibold whitespace-nowrap">
                    {name}
                    {u.id === me.id ? <span className="ml-2 text-xs font-normal text-muted">(you)</span> : null}
                  </Td>
                  <Td className="text-gold">{u.staff?.displayCode ?? "—"}</Td>
                  <Td>
                    <Pill tone={ROLE_TONE[u.role as keyof typeof ROLE_TONE]}>{ROLE_LABEL[u.role]}</Pill>
                  </Td>
                  <Td>{u.email}</Td>
                  <Td>{active ? <Pill tone="green">Active</Pill> : <Pill tone="grey">Turned off</Pill>}</Td>
                  <Td>
                    <div className="flex flex-wrap items-start gap-2">
                      {u.id !== me.id ? (
                        <ModalButton
                          label="Reset password"
                          title={`Reset ${name}'s password`}
                          description="They're logged out everywhere and get a new temporary password."
                          variant="ghost"
                          plus={false}
                          className="!px-3 !py-1.5 text-xs"
                        >
                          <ActionForm action={resetStaffPasswordAction} hidden={{ userId: u.id }} className="flex flex-col gap-3">
                            <div>
                              <SubmitButton pendingText="Resetting…">Reset password</SubmitButton>
                            </div>
                          </ActionForm>
                        </ModalButton>
                      ) : null}
                      {u.id !== me.id ? (
                        <ActionForm action={setStaffActiveAction} hidden={{ userId: u.id, active: String(!active) }} className="flex flex-col gap-1">
                          <SubmitButton variant={active ? "danger" : "ghost"} className="!px-3 !py-1.5 text-xs" aria-label={`${active ? "Turn off" : "Turn on"} ${name}`}>
                            {active ? "Turn off" : "Turn on"}
                          </SubmitButton>
                        </ActionForm>
                      ) : (
                        <span className="text-xs text-muted">Change your password on your profile.</span>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
