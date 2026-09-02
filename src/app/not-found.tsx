import Link from "next/link";

/**
 * Nothing at this address. Two ways out, no illustration, no "404" set at
 * 120px, because the number is the least useful thing on the page.
 */
const NotFound = () => (
  <main className="flex min-h-dvh flex-col justify-center px-6 py-7 wide:px-9">
    <div className="max-w-[42ch]">
      <p className="mb-8 font-record text-label text-faint uppercase tracking-[0.16em]">Inquora</p>
      <h1 className="mb-3 font-light font-reading text-[2rem] leading-tight">
        There is nothing at this address.
      </h1>
      <p className="mb-6 font-record text-[0.82rem] text-soft">
        The link may have been shortened, or the conversation it pointed at may have been deleted.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-hair border border-mark px-4 py-2 font-record text-label text-mark uppercase tracking-[0.13em] transition-colors duration-150 ease-out-quart hover:bg-wash"
      >
        Back to the start
      </Link>
    </div>
  </main>
);

export default NotFound;
