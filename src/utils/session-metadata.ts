import { TypeSessionMetadata } from "@/types/rag";

export const getSessionMetadata = (): TypeSessionMetadata => {
  if (typeof window === "undefined") return {};

  const { navigator, screen } = window;
  const { userAgent, platform, language } = navigator;
  // @ts-expect-error - session is dynamically assigned
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    device: /Mobile|Android|iP(ad|hone)/i.test(userAgent) ? "Mobile" : "Desktop",
    browser: getBrowserName(userAgent),
    location: Intl.DateTimeFormat().resolvedOptions().timeZone, // Rough proxy
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenSize: `${screen.width}x${screen.height}`,
    platform: platform,
    language: language,
    connection: connection ? connection.effectiveType : undefined,
  };
};

const getBrowserName = (userAgent: string): string => {
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("SamsungBrowser")) return "Samsung Internet";
  if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera";
  if (userAgent.includes("Trident")) return "Internet Explorer";
  if (userAgent.includes("Edge")) return "Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  return "Unknown";
};
