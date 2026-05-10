import type { MetadataRoute } from "next";
import { getSiteUrl, isNoIndexSite } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  if (isNoIndexSite()) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/settings"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
