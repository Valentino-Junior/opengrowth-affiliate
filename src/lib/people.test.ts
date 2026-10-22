import { describe, expect, it } from "vitest";
import type { AffiliateWithUser } from "./people";
import { selfReferralReasons } from "./people";
import { normalizeEmail, normalizeHandle, normalizePhone } from "./contacts";

const affiliate = {
  payoutHandle: "$Affiliate06",
  user: { email: "Affiliate06@opengrowth.local", phone: "+15550100006" },
} as unknown as AffiliateWithUser;

describe("selfReferralReasons", () => {
  it("a player with their own details is clean", () => {
    expect(selfReferralReasons({ email: "p@example.com", phone: "555-020-0023", paymentHandle: "$p23" }, affiliate)).toEqual([]);
  });

  it("matches the affiliate's phone however it is typed (mockup: Player 23)", () => {
    expect(selfReferralReasons({ phone: "(555) 010-0006" }, affiliate)).toEqual(["phone_match"]);
  });

  it("matches email case-insensitively and payment handles with or without $/@", () => {
    expect(
      selfReferralReasons({ email: " affiliate06@OPENGROWTH.local ", paymentHandle: "@affiliate06" }, affiliate),
    ).toEqual(["email_match", "payment_handle_match"]);
  });

  it("missing details never match", () => {
    expect(selfReferralReasons({}, affiliate)).toEqual([]);
  });
});

describe("normalizers", () => {
  it("phone → E.164", () => {
    expect(normalizePhone("(555) 010-0006")).toBe("+15550100006");
    expect(normalizePhone("1-555-010-0006")).toBe("+15550100006");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("email and handle", () => {
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
    expect(normalizeHandle("$Player07")).toBe("player07");
  });
});
