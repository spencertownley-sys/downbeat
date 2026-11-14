import type { MetadataRoute } from "next";

// Public pages only. Never list band, member or rejoin links.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://trydownbeat.app";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
