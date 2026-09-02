import { SignInForm } from "@/ui/components/auth/SignInForm";

/**
 * A server component whose only job is to read the `next` parameter and hand it
 * to the form, so an OAuth round trip returns to the page that asked for a
 * sign-in. The value is validated where it is used, in the callback route.
 */
const LoginPage = async ({ searchParams }: { searchParams: Promise<{ next?: string }> }) => {
  const { next } = await searchParams;

  return <SignInForm next={next} />;
};

export default LoginPage;
