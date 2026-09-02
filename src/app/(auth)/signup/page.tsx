import type { Metadata } from "next";
import { SignUpForm } from "@/ui/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an Inquora account.",
};

const SignupPage = () => <SignUpForm />;

export default SignupPage;
