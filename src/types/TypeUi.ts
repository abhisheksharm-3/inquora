import { buttonVariants } from "@/components/ui/button";
import { VariantProps } from "class-variance-authority";
import { TypeChat } from "./TypeSupabase";
import { MotionProps } from "motion/react";

export interface TypeButtonCta
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  link?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  showArrow?: boolean;
}

export interface TypeGlowProps {
  className?: string;
  glowElements?: {
    position: string;
    size: {
      width: number;
      height: number;
    };
    blur?: number;
    color?: string;
  }[];
}

export interface TypeDialogProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}

export interface TypeSectionHeaderProps {
  subtitle?: string;
  title?: string;
  subtitleClassName?: string;
  titleClassName?: string;
}
export interface TypeDropdownAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  handler: (
    e: React.MouseEvent,
    chat: TypeChat,
    file?: { name?: string },
  ) => void;
}

export interface TypeSkeletonConfig {
  height: string;
  width: string;
  className?: string;
}

export interface TypeHistoryPageChatMetadataProps {
  chat: TypeChat;
  file?: { name?: string; type?: string; size?: number } | null;
  isMobile?: boolean;
}

export interface TypeHistoryPageChatDropdownProps {
  chat: TypeChat;
  file?: { name?: string } | null;
}

export interface TypeErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export interface TypeWordRotateProps {
  words: string[];
  duration?: number;
  motionProps?: MotionProps;
  className?: string;
}

export interface LayoutProps {
  children: React.ReactNode;
  /**
   * Whether to show the dither background behind the navbar
   * @default true
   */
  showDitherBackground?: boolean;
  /**
   * Whether to apply backdrop blur to the navbar
   * @default true
   */
  enableNavbarBlur?: boolean;
  /**
   * Custom className for the main content wrapper
   */
  contentClassName?: string;
  /**
   * Whether to show the footer
   * @default true
   */
  showFooter?: boolean;
  /**
   * Custom dither configuration
   */
  ditherConfig?: {
    waveColor?: [number, number, number];
    disableAnimation?: boolean;
    fullscreen?: boolean;
    enableMouseInteraction?: boolean;
    mouseRadius?: number;
    colorNum?: number;
    waveAmplitude?: number;
    waveFrequency?: number;
    waveSpeed?: number;
  };
}

export interface TypeSlide {
  type: "image" | "video";
  src: string;
  caption: string;
  title?: string;
}
