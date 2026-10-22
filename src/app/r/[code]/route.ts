import { NextResponse } from "next/server";

// Affiliate referral link: /r/OG-A01 → player signup with the code filled in.
export function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  return params.then(({ code }) =>
    NextResponse.redirect(new URL(`/join/player?ref=${encodeURIComponent(code.toUpperCase())}`, request.url)),
  );
}
