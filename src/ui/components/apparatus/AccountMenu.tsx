"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";
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
  const [signingOut, startSignOut] = useTransition();

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
          className="z-20 min-w-[17rem] rounded-hair border border-rule bg-panel py-1.5 shadow-[0_20px_50px_-28px_rgb(0_0_0/0.55)]"
        >
          {/* Who you are, set as a name rather than as another menu row. Every
              line in this menu used to be the same size and colour, so the
              identity, the destinations, the preference and the way out all
              read as five links. */}
          <div className="mb-1.5 border-rule border-b px-3.5 pt-2 pb-3">
            {displayName ? (
              <p className="m-0 truncate font-light font-reading text-[1.05rem] text-ink">
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
          <Dropdown.Label className="px-3.5 pb-2 font-record text-label text-faint uppercase tracking-[0.12em]">
            Theme
          </Dropdown.Label>

          {/* One row of three, not three rows. A preference with three values is
              a choice between them; stacked, the current one was a dot floating
              at the far right of a line and the other two were menu commands.
              `preventDefault` keeps the menu open, so all three can be tried. */}
          <Dropdown.RadioGroup
            value={theme ?? "system"}
            onValueChange={setTheme}
            className="mx-3.5 mb-1 flex rounded-hair border border-rule p-0.5"
          >
            {THEMES.map((choice) => (
              <Dropdown.RadioItem
                key={choice.value}
                value={choice.value}
                onSelect={(event) => event.preventDefault()}
                className="flex flex-1 items-center justify-center rounded-[1px] py-1.5 font-record text-label text-soft outline-none data-highlighted:text-ink data-[state=checked]:bg-wash data-[state=checked]:text-ink"
              >
                {choice.label}
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>

          <Dropdown.Separator className="my-2 h-px bg-rule" />

          {/*
           * Called from `onSelect` rather than submitted from a form.
           *
           * It was a submit button inside a Radix item, and a menu closes on
           * select: the form unmounted before the browser submitted it, so
           * clicking Sign out did nothing at all. `preventDefault` keeps the
           * menu open until the action's redirect takes the page.
           */}
          <Dropdown.Item
            disabled={signingOut}
            onSelect={(event) => {
              event.preventDefault();
              startSignOut(async () => {
                await signOutAction();
              });
            }}
            className="mx-1 flex cursor-pointer items-center justify-between rounded-hair px-2.5 py-2 font-record text-[0.78rem] text-soft outline-none data-highlighted:bg-wash data-highlighted:text-danger"
          >
            {signingOut ? "Signing out" : "Sign out"}
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
};

const THEMES = [
  { value: "light", label: "Light" },
  { value: "system", label: "Auto" },
  { value: "dark", label: "Dark" },
] as const;

const Item = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Dropdown.Item asChild>
    <Link
      href={href}
      className="flex items-center px-3.5 py-2 font-record text-[0.78rem] text-soft outline-none hover:text-ink data-highlighted:bg-wash data-highlighted:text-ink"
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
