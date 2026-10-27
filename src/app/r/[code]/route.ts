// Affiliate referral link: /r/OG-A01 → player signup with the code filled in.
// The redirect is relative: behind nginx the app only sees its internal address (0.0.0.0:3000), never the public one.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return new Response(null, { status: 307, headers: { Location: `/join/player?ref=${encodeURIComponent(code.toUpperCase())}` } });
}
