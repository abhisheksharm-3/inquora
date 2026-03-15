import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { TypeButtonCta } from "@/types/ui";
import { ArrowRight } from "lucide-react";

/**
 * Renders a reusable call-to-action (CTA) button wrapped in a Next.js Link.
 *
 * @param {TypeButtonCta} props - The component props.
 * @param {string} [props.label="Get Started"] - The text displayed on the button.
 * @param {string} [props.link="#"] - The destination URL for the link.
 * @param {string} [props.variant="default"] - The button's visual style.
 * @param {string} [props.size="lg"] - The button's size.
 * @param {boolean} [props.showArrow=false] - If true, displays an arrow icon.
 * @param {string} [props.className] - Additional classes to apply to the button.
 * @returns {JSX.Element} The rendered CTA button component.
 */
const ButtonCta = ({
  label = "Get Started",
  link = "#",
  variant = "default",
  size = "lg",
  showArrow = false,
  className,
  ...props
}: TypeButtonCta) => {
  return (
    <Link href={link}>
      <Button
        variant={variant}
        size={size}
        className={cn(
          "cursor-pointer px-8 py-4 text-base transition-colors",
          className,
        )}
        {...props}
      >
        {label}
        {showArrow && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </Link>
  );
};

export default ButtonCta;
