import Dither from "@/components/backgrounds/Dither/Dither";
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
  const brandViolet: [number, number, number] = [0.408, 0.212, 0.796];

  return (
    <div className="relative flex min-h-screen w-full text-foreground">
      <div className="absolute inset-0 -z-10">
        <Dither waveColor={brandViolet} waveAmplitude={0.1} />
        <div className="absolute inset-0 bg-background/80 dark:bg-background/60" />
      </div>

      <DashboardDesktopSidebar />
      <DashboardMobileSidebar />

      <div className="flex flex-1 flex-col">
        <DashboardMobileHeader />
        <DashboardDesktopHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 py-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;