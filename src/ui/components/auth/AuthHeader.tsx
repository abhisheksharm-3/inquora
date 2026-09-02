import type { TypeAuthHeaderProps } from "@/ui/lib/auth.types";
/**
 * @description A clean, left-aligned header for the auth form.
 */
export const AuthHeader: React.FC<TypeAuthHeaderProps> = ({ title, subtitle }) => (
  <div className="flex flex-col space-y-2 text-left">
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);
