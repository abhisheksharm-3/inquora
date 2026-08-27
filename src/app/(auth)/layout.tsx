import { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";

export const metadata: Metadata = {
  title: "Authentication - Inquora",
  description: "Login or sign up to access your Inquora dashboard.",
};

/**
 * @description A definitive, asymmetric layout for authentication. It reserves a
 * fixed-width column for the form, ensuring a consistent, app-like feel, while
 * the branding panel dynamically fills the remaining space.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout showFooter={false} enableNavbarBlur={false} contentClassName="w-full">
      <div className="absolute inset-0 bg-background/80 dark:bg-background/60" />

      {/* Mobile-first approach */}
      <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-[1fr_480px]">
        {/* Hide branding panel on mobile, show on desktop */}
        <div className="hidden lg:block">
          <AuthBrandingPanel />
        </div>

        {/* Form container - full height on mobile, centered on desktop */}
        <div className="relative flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </Layout>
  );
}
