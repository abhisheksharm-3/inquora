import { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Github, Chrome } from "lucide-react";

export const AuthSocialLogins = (): JSX.Element => {
  // TODO: Implement onClick handlers
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Button variant="outline" className="h-11 cursor-pointer"><Chrome className="mr-2 h-4 w-4" /> Google</Button>
      <Button variant="outline" className="h-11 cursor-pointer"><Github className="mr-2 h-4 w-4" /> GitHub</Button>
    </div>
  );
};