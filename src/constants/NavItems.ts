import { Clock, File, Settings } from "lucide-react";

/**
 * An array of configuration objects for the main desktop sidebar navigation.
 * Each object defines a navigation link and its corresponding icon.
 */
export const NavigationItems = [
  { title: "New Chat", href: "/choose", icon: File },
  { title: "History", href: "/history", icon: Clock },
  { title: "Account Settings", href: "/settings", icon: Settings },
] as const;

/**
 * An array of configuration objects for the mobile navigation menu.
 * Each object includes a link, icon, title, and a brief description for display.
 */
export const MobileNavItems = [
  {
    href: "/choose",
    icon: File,
    title: "New Note",
    description: "Record and create new note",
  },
  {
    href: "/history",
    icon: Clock,
    title: "History",
    description: "Record and create new note",
  },
  {
    href: "/settings",
    icon: Settings,
    title: "Account Settings",
    description: "Manage your account preferences",
  },
] as const;

/**
 * An array of configuration objects for routes displayed in the public-facing navbar.
 * These are typically used for marketing or informational pages.
 */
export const PublicNavbarRoutes = [
  { label: "Pricing", url: "/#pricing" },
  { label: "FAQ", url: "/#faq" },
];

/**
 * An array of configuration objects for rendering call-to-action (CTA) buttons.
 * Each object defines the button's label, navigation link, and visual variant.
 */
export const CtaButtons = [
  { label: "Login", link: "/login", variant: "outline" as const },
  { label: "Try For Free", link: "/signup", variant: "default" as const },
];
