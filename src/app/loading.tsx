/**
 * The shell while a route resolves. A line of record rather than a spinner,
 * because a spinner says only that something is happening, and reserving the
 * space the page is about to occupy keeps the layout from shifting under it.
 */
const Loading = () => (
  <main className="flex min-h-dvh flex-col justify-center px-6 py-7 wide:px-9">
    <p className="font-record text-label text-faint uppercase tracking-[0.16em]">
      Inquora · loading
    </p>
  </main>
);

export default Loading;
