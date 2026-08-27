import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

import { TypeDialogProps } from "@/types/ui";

/**
 * @description A list of features included in the free beta plan.
 */
const featuresIncluded = [
  "AI-powered conversations",
  "Support for all document formats",
  "Unlimited uploads & queries",
  "Secure cloud storage",
  "Real-time collaboration",
];

/**
 * A simplified pricing dialog for the beta phase showing only free access.
 */
const PricingDialog = ({ trigger }: TypeDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-hidden">
        <DialogHeader className="space-y-3">
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="inline-flex items-center gap-2 rounded-full px-3 py-1"
            >
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary/80" />
              <span className="text-xs font-medium">Pricing</span>
            </Badge>
          </div>
          <DialogTitle className="text-center text-xl sm:text-2xl">
            Free While We&apos;re in Beta
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            Enjoy full access to all features during our beta phase.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <Card className="border bg-card/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
                {/* Left Column: Price */}
                <div className="flex-1 text-center md:text-left">
                  <p className="text-xs font-medium text-primary mb-2">PLAN</p>
                  <p className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter">
                    Free
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">During our Beta phase</p>
                </div>

                {/* Right Column: Features */}
                <div className="flex-1 border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                  <p className="text-sm font-semibold mb-4">Includes full access to:</p>
                  <ul className="space-y-2">
                    {featuresIncluded.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex flex-col items-center space-y-2 sm:flex-col sm:justify-center">
          <Button size="lg" className="w-full max-w-xs font-semibold">
            Continue with Free Plan
          </Button>
          <p className="text-center text-xs text-muted-foreground/70">No credit card required.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PricingDialog;
