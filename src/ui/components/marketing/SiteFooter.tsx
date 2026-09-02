import Link from "next/link";

/**
 * The footer.
 *
 * What this replaces was not a footer: a heading, two underlined words and a
 * paragraph of mono privacy text, all at the same weight, with nothing to tell
 * a reader they had reached the end of the page.
 *
 * A footer's job is to answer "what now" for somebody who read everything and
 * did not click. So the way in is repeated as an actual control, the promises
 * about their files are restated plainly where somebody deciding will look for
 * them, and the page is signed.
 */
const columns = [
  {
    heading: "Get started",
    links: [
      { label: "Create an account", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    heading: "Learn more",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "What an answer looks like", href: "/#example" },
    ],
  },
];

export const SiteFooter = () => (
  <footer className="border-rule border-t">
    <div className="grid grid-cols-1 gap-10 px-7 py-12 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] sm:gap-8 wide:px-10 wide:py-14">
      <div>
        <p className="flex items-baseline gap-2">
          <span className="font-reading text-[1.2rem] text-ink tracking-[0.01em]">Inquora</span>
          <span aria-hidden className="size-1 rounded-full bg-mark" />
        </p>

        <p className="mt-3 max-w-[34ch] font-light font-reading text-[1.02rem] text-soft leading-relaxed">
          Ask your documents a question and reach the lines behind the answer in one click.
        </p>

        <Link
          href="/signup"
          className="mt-6 inline-flex h-10 items-center rounded-hair border border-mark px-4 font-record text-[0.72rem] text-mark uppercase tracking-[0.12em] transition-colors duration-150 ease-out-quart hover:bg-wash"
        >
          Start reading
        </Link>
      </div>

      {columns.map((column) => (
        <nav key={column.heading} aria-label={column.heading}>
          <h2 className="mb-3.5 font-medium font-record text-label text-faint uppercase tracking-[0.13em]">
            {column.heading}
          </h2>
          <ul className="m-0 grid list-none gap-1 p-0">
            {column.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-9 items-center font-light font-reading text-[1rem] text-soft hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>

    {/* The bottom bar. It was a paragraph of faint mono restating the privacy
        promise the page already makes in its own section, and a credit pushed
        so far right it fell off a narrow screen. A closing bar should say who
        made the thing and what year it is, legibly, and stop. */}
    <div className="border-rule border-t px-7 py-7 wide:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* No year. `new Date()` is an unstable value, which cacheComponents
            refuses to prerender, and a hardcoded year is wrong from January.
            A copyright line without one says the same thing. */}
        <p className="m-0 font-record text-[0.72rem] text-soft">&copy; Inquora</p>

        <p className="m-0 font-record text-[0.72rem] text-soft">
          Designed and built by{" "}
          <a
            href="https://abhisheksan.com"
            target="_blank"
            rel="noreferrer"
            className="border-mark border-b pb-0.5 text-ink transition-colors duration-150 ease-out-quart hover:bg-wash"
          >
            Abhishek Sharma
          </a>
        </p>
      </div>
    </div>
  </footer>
);
