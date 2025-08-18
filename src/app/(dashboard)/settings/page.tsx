"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LogoutDialog from "@/components/dashboard/LogoutDialog";
import { useUser } from "@/hooks/useUser";
import { SettingsLoadingSkeleton } from "@/components/settings/SettingsLoadingSkeleton";
import { MobileSettingsSections } from "@/constants/SettingsData";
import { User, Crown, Shield, LogOut } from "lucide-react";
import avatarImage from "@/assets/images/avatar.svg";
import { getUserInitials } from "@/utils/dashboard-utils";
import PricingDialog from "@/components/dashboard/PricingDialog";

/**
 * Renders the user account settings page.
 *
 * This page displays user information, account details, and subscription
 * status in a responsive grid layout. It includes actions for upgrading the
 * plan and logging out. A loading skeleton is shown while user data is being
 * fetched.
 *
 * @returns {JSX.Element} The rendered settings page.
 */
const SettingsPage = () => {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <SettingsLoadingSkeleton isMobile={false} />;
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 p-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent pb-2 md:text-5xl">
          Account Settings
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Manage your profile, subscription, and account preferences in one place.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Profile & Account Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarImage} alt="User Avatar" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    {user?.name || "Anonymous User"}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {user?.email}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Account Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Account Information</CardTitle>
              </div>
              <CardDescription>
                Your personal account details and information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MobileSettingsSections.map((section, index) => (
                  <div key={section.id}>
                    <div className="flex items-center justify-between py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {section.label}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {section.getUserValue(user)}
                      </div>
                    </div>
                    {index < MobileSettingsSections.length - 1 && (
                      <Separator />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Subscription & Actions */}
        <div className="space-y-6">
          {/* Subscription Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Crown className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Subscription</CardTitle>
              </div>
              <CardDescription>
                Manage your current plan and billing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Free Plan</p>
                  <p className="text-xs text-muted-foreground">
                    Full access during beta
                  </p>
                </div>
                <Badge variant="secondary" className="font-medium">
                  Active
                </Badge>
              </div>
              
              <PricingDialog
                trigger={
                  <Button variant="outline" className="w-full cursor-pointer" size="lg">
                    <Crown className="mr-2 h-4 w-4" />
                    View Plan Details
                  </Button>
                }
              />
            </CardContent>
          </Card>

          {/* Account Actions Card */}
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Account Actions</CardTitle>
              </div>
              <CardDescription>
                Critical account management options.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogoutDialog
                trigger={
                  <Button 
                    variant="destructive" 
                    className="w-full cursor-pointer" 
                    size="lg"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;