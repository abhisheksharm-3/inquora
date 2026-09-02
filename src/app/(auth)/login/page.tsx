import { Suspense } from "react";
import { SignInForm } from "@/ui/components/auth/SignInForm";

/**
 * The `next` parameter, read inside `<Suspense>`.
 *
 * Reading it in the page body made the whole route wait on the URL before
 * anything could paint, which Next reports as a route that cannot have an
 * instant shell. The form is the same form either way, so it is its own
 * fallback: the shell paints immediately, and the one link that depends on
 * `next` resolves a moment later.
 */
const LoginPage = ({ searchParams }: { searchParams: Promise<{ next?: string }> }) => (
  <Suspense fallback={<SignInForm />}>
    <WithNext searchParams={searchParams} />
  </Suspense>
);

const WithNext = async ({ searchParams }: { searchParams: Promise<{ next?: string }> }) => {
  const { next } = await searchParams;

  return <SignInForm next={next} />;
};

export default LoginPage;
