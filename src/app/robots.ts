import type { MetadataRoute } from "next";

// Member, invite and rejoin links are credentials; they also send noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/a/", "/join/", "/rejoin/", "/login", "/signup"],
    },
    sitemap: "https://trydownbeat.app/sitemap.xml",
    host: "https://trydownbeat.app",
  };
}
