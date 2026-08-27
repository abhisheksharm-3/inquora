import { DashboardDesktopSidebar } from "@/components/dashboard/DashboardDesktopSidebar";
import { DashboardMobileSidebar } from "@/components/dashboard/DashboardMobileSidebar";
import {
  DashboardDesktopHeader,
  DashboardMobileHeader,
} from "@/components/dashboard/DashboardHeaders";

/**
 * The main layout for the application's dashboard section.
 *
 * This component arranges the primary UI elements, including a responsive
 * sidebar, a header, and the main content area, all layered on top of the
 * signature dithered background.
 *
 * @param {{ children: React.ReactNode }} props - The component props.
 * @returns {JSX.Element} The rendered dashboard layout.
 */
const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex min-h-screen w-full text-foreground">
      <DashboardDesktopSidebar />
      <DashboardMobileSidebar />

      <div className="flex flex-1 flex-col">
        <DashboardMobileHeader />
        <DashboardDesktopHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 py-10 min-h-0">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
