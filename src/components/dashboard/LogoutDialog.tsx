"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Shield, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { TypeDialogProps } from "@/types/ui";

/**
 * Renders a confirmation dialog for logging out.
 *
 * This component provides a themed modal that asks the user to confirm their
 * decision to sign out. It handles the asynchronous logout process, displays
 * a loading state, and redirects the user upon success.
 *
 * @param {TypeDialogProps} props - The component props.
 * @param {React.ReactNode} props.trigger - The element that opens the dialog.
 * @returns {JSX.Element} The rendered logout dialog component.
 */
const LogoutDialog = ({ trigger }: TypeDialogProps) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { signOut, isSigningOut } = useUser();

  const handleLogout = async () => {
    try {
      await signOut();
      setOpen(false);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md border-border/50 bg-card/95 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-destructive/5 rounded-lg" />

        <DialogHeader className="relative text-center pb-6">
          <div className="mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-destructive/20 blur-xl animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20 shadow-lg">
              <div className="absolute inset-1 rounded-full bg-gradient-to-br from-card to-transparent" />
              <Shield className="relative h-8 w-8 text-destructive drop-shadow-sm" />
            </div>
          </div>

          <DialogTitle className="text-2xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-3">
            End Your Session?
          </DialogTitle>

          <DialogDescription className="text-muted-foreground/90 leading-relaxed text-base max-w-sm mx-auto">
            You&apos;re about to sign out of your account. Your work is
            automatically saved, but you&apos;ll need to sign in again to
            continue.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex items-start gap-3 p-4 mb-4 rounded-lg bg-muted/30 border border-border/50">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Security tip
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Always sign out when using shared or public devices to protect
              your account.
            </p>
          </div>
        </div>

        <DialogFooter className="relative flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <DialogClose asChild>
            <Button
              variant="outline"
              disabled={isSigningOut}
              className="flex-1 h-11 font-medium transition-all duration-200 hover:bg-accent/80 cursor-pointer"
            >
              Stay Signed In
            </Button>
          </DialogClose>

          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="flex-1 cursor-pointer h-11 font-medium bg-gradient-to-r from-destructive to-destructive/90 hover:from-destructive/90 hover:to-destructive/80 transition-all duration-200 shadow-lg hover:shadow-destructive/25"
          >
            {isSigningOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogoutDialog;
