import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/ui/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Send yourself a link to set a new password.",
};

const ForgotPasswordPage = () => <ForgotPasswordForm />;

export default ForgotPasswordPage;
