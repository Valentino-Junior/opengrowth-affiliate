import type { NextConfig } from "next";

// `npm run dev` evaluates code and live-reloads over a websocket; production (`next build`) needs neither,
// so only development relaxes the policy. Without this, no page is interactive in dev.
const isDev = process.env.NODE_ENV !== "production";

// Security headers on every response. HTTPS (and HSTS) is terminated by Caddy in front of the app.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    // Next.js needs inline scripts/styles for hydration; everything else is same-origin. No framing, no plugins.
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Payment screenshots and ID photos are uploaded through server actions (10 MB each + form fields).
    serverActions: { bodySizeLimit: "21mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
