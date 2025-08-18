import type { TypeAuthLinkProps } from "@/types/TypeAuth";
import Link from "next/link";
import { JSX } from "react";

/**
 * Renders a themed navigational link for authentication pages, typically
 * used to direct users to an alternative action (e.g., from a login page
 * to a sign-up page).
 *
 * @param {TypeAuthLinkProps} props - The component props.
 * @param {string} props.text - The static text preceding the link.
 * @param {string} props.linkText - The clickable link text.
 * @param {string} props.href - The destination path for the link.
 * @returns {JSX.Element} The rendered link component.
 */
export const AuthLink = ({
  text,
  linkText,
  href,
}: TypeAuthLinkProps): JSX.Element => (
  <div className="text-center text-sm animate-in fade-in duration-700 delay-300 fill-mode-backwards">
    <span className="text-muted-foreground">{text} </span>
    <Link
      href={href}
      className="rounded-sm font-medium text-primary underline-offset-4 transition-all duration-300 hover:text-primary/80 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {linkText}
    </Link>
  </div>
);