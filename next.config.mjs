// Content Security Policy. Clerk (sign-in for band leaders) loads its script
// and API from clerk.trydownbeat.app, bot detection from Clerk Protect, and a
// Cloudflare Turnstile challenge. 'unsafe-inline' covers the theme script in
// the root layout and Next's inline bootstrap scripts.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://clerk.trydownbeat.app https://cdn.protect.clerk.com https://*.client.protect.clerk.com https://challenges.cloudflare.com",
  "connect-src 'self' https://clerk.trydownbeat.app https://*.client.protect.clerk.com",
  "img-src 'self' data: https://img.clerk.com",
  "style-src 'self' 'unsafe-inline'",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          // Report-only until sign-in and the member flow have been checked in
          // production with no CSP errors in the console; then rename the key
          // to Content-Security-Policy to enforce it.
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
      // Member and rejoin URLs carry credentials in the path: never send them
      // as a Referer. Listed last so it overrides the site-wide value.
      ...["/a/:path*", "/rejoin/:path*"].map((source) => ({
        source,
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
    ];
  },
};

export default nextConfig;
