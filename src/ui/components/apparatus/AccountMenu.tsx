"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { signOutAction } from "@/app/(app)/actions";
import { AUTH_ROUTES, DASHBOARD_ROUTES } from "@/core/routes";
import type { Account } from "@/core/workspace/account.types";

/**
 * Who you are signed in as, and everything that belongs to being signed in:
 * settings, changing your password, and signing out.
 *
 * These had nowhere to live. There was no way to sign out of the product at
 * all, and changing a password meant remembering the reset URL.
 *
 * Radix rather than a hand-rolled popover. A menu owes a reader focus that
 * moves into it and back, Escape, a click outside, arrow keys and the right
 * roles, and that is a genuinely hard 200 lines to write correctly. The skin
 * is ours; the behaviour is theirs.
 */
export const AccountMenu = ({ account }: { account: Account }) => {
  const { email, displayName, avatarUrl } = account;
  const { theme, setTheme } = useTheme();

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-rule font-record text-[0.7rem] text-soft uppercase transition-colors duration-150 ease-out-quart hover:border-soft hover:text-ink data-[state=open]:border-mark data-[state=open]:text-mark"
        aria-label={`Account: ${displayName ?? email}`}
      >
        {/* The picture Google supplies when somebody signs in with it, and
          initials otherwise. A generic silhouette says less than two letters
          do, and there is nowhere to upload a picture. */}
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-full object-cover"
            // Referrer withheld, so Google is not told which page of this
            // application the request came from.
            referrerPolicy="no-referrer"
          />
        ) : (
          initials(displayName, email)
        )}
      </Dropdown.Trigger>

      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          className="z-20 min-w-[15rem] rounded-hair border border-rule bg-panel py-2 shadow-[0_18px_44px_-30px_rgb(0_0_0/0.6)] data-[state=open]:animate-in"
        >
          <div className="border-rule border-b px-3.5 pb-3">
            {displayName ? (
              <p className="m-0 truncate font-light font-reading text-[1rem] text-ink">
                {displayName}
              </p>
            ) : null}
            <p className="m-0 truncate font-record text-label text-faint">{email}</p>
          </div>

          <Item href={DASHBOARD_ROUTES.SETTINGS}>Your documents and usage</Item>
          <Item href={AUTH_ROUTES.FORGOT}>Change your password</Item>

          <Dropdown.Separator className="my-2 h-px bg-rule" />

          {/* The theme, where a preference belongs. It spent three versions as a
              permanent widget beside the navigation — three words, then a
              bordered segmented control, then a lone icon button — and each one
              competed for attention with the primary action. */}
          <Dropdown.Label className="px-3.5 pb-1.5 font-record text-label text-faint uppercase tracking-[0.12em]">
            Theme
          </Dropdown.Label>
          <Dropdown.RadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            {THEMES.map((choice) => (
              <Dropdown.RadioItem
                key={choice.value}
                value={choice.value}
                className="flex cursor-pointer items-center justify-between gap-6 px-3.5 py-2 font-record text-[0.78rem] text-soft outline-none data-highlighted:bg-wash data-highlighted:text-ink data-[state=checked]:text-ink"
              >
                {choice.label}
                <Dropdown.ItemIndicator>
                  <span aria-hidden className="block size-1.5 rounded-full bg-mark" />
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>

          <Dropdown.Separator className="my-2 h-px bg-rule" />

          {/* A form, so signing out is a POST rather than a link somebody's
            browser or a link-prefetcher can follow on its own. */}
          <form action={signOutAction}>
            <Dropdown.Item asChild>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center px-3.5 py-2 text-left font-record text-[0.78rem] text-soft outline-none hover:text-ink data-highlighted:bg-wash data-highlighted:text-ink"
              >
                Sign out
              </button>
            </Dropdown.Item>
          </form>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
};

const THEMES = [
  { value: "light", label: "Light" },
  { value: "system", label: "Match my system" },
  { value: "dark", label: "Dark" },
] as const;

const Item = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Dropdown.Item asChild>
    <Link
      href={href}
      className="flex cursor-pointer items-center px-3.5 py-2 font-record text-[0.78rem] text-soft outline-none hover:text-ink data-highlighted:bg-wash data-highlighted:text-ink"
    >
      {children}
    </Link>
  </Dropdown.Item>
);

/** `AS` from a name, `AB` from an address, one letter when that is all there is. */
const initials = (displayName: string | null, email: string): string => {
  const source = displayName?.trim() || email.split("@")[0] || "?";
  const words = source.split(/[\s._-]+/).filter(Boolean);

  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();

  return source.slice(0, 2).toUpperCase();
};
