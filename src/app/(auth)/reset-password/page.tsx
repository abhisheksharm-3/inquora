import type { Metadata } from "next";
import { ResetPasswordForm } from "@/ui/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
};

/**
 * Reached from the recovery link, which has already exchanged its code for a
 * session by the time this renders. No session means the link expired, and the
 * form says so rather than failing on submit.
 */
const ResetPasswordPage = () => <ResetPasswordForm />;

export default ResetPasswordPage;
