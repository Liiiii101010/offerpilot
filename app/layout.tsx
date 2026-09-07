import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "OfferPilot｜求职行动 Copilot";
const description =
  "基于真实经历证据的开源求职 AI Copilot：人岗匹配、经历缺口、简历优化、投递文案与面试准备。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title,
    description,
    icons: {
      icon: [
        { url: "/favicon.ico?v=4", type: "image/x-icon", sizes: "any" },
        { url: "/favicon.png?v=4", type: "image/png", sizes: "64x64" },
      ],
      shortcut: "/favicon.ico?v=4",
      apple: "/favicon.png?v=4",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "OfferPilot 求职行动 Copilot" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="/favicon.ico?v=4" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=4" />
      </head>
      <body>{children}</body>
    </html>
  );
}
