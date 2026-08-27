"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LogoutDialog from "@/components/dashboard/LogoutDialog";
import { SettingsLoadingSkeleton } from "@/components/settings/SettingsLoadingSkeleton";
import { StatCard } from "@/components/settings/StatCard";
import { ActivityItem } from "@/components/settings/ActivityItem";
import { MobileSettingsSections } from "@/constants/settings-data";
import { useSettings } from "@/hooks/useSettings";
import {
  User,
  Crown,
  Shield,
  LogOut,
  MessageSquare,
  FileText,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  Calendar,
  Settings,
  Palette,
  Bell,
} from "lucide-react";
import avatarImage from "@/assets/images/avatar.svg";
import { useTheme } from "next-themes";
import { getUserInitials } from "@/utils/dashboard-utils";
import PricingDialog from "@/components/dashboard/PricingDialog";

/**
 * Settings page with user statistics and activity insights
 */
const SettingsPage = () => {
  const { user, avatarUrl, stats, recentActivity, isLoading } = useSettings();
  const { resolvedTheme } = useTheme();

  if (isLoading) {
    return <SettingsLoadingSkeleton isMobile={false} />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6 chat-list-scroll smooth-scroll">
          <div className="container mx-auto max-w-7xl space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-muted-foreground bg-clip-text text-transparent pb-2 md:text-5xl">
                    Account Settings
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    Manage your profile, track your activity, and customize your experience.
                  </p>
                </div>
                <div className="hidden md:flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    <Activity className="w-3 h-3 mr-1" />
                    {stats?.accountAge || 0} days active
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {stats?.recentChats || 0} chats this week
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Chats"
                value={stats?.totalChats || 0}
                icon={MessageSquare}
                subtitle={`${stats?.recentChats || 0} this week`}
                subtitleIcon={TrendingUp}
                colorScheme="primary"
              />
              <StatCard
                title="Files Uploaded"
                value={stats?.totalFiles || 0}
                icon={FileText}
                subtitle={`${stats?.recentFiles || 0} this week`}
                subtitleIcon={Clock}
                colorScheme="blue"
              />
              <StatCard
                title="Messages Sent"
                value={stats?.estimatedMessages || 0}
                icon={Zap}
                subtitle={`Most active ${stats?.mostActiveDay}`}
                subtitleIcon={Activity}
                colorScheme="green"
              />
              <StatCard
                title="Days Active"
                value={stats?.accountAge || 0}
                icon={Calendar}
                subtitle="Free Plan Member"
                subtitleIcon={Crown}
                colorScheme="purple"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Profile Card */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
                  <CardHeader className="relative">
                    <div className="flex items-center space-x-6">
                      <div className="relative">
                        <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                          <AvatarImage src={avatarUrl ?? avatarImage} alt="User Avatar" />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                          <div className="h-2 w-2 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="space-y-2 flex-1">
                        <CardTitle className="text-2xl font-bold">
                          {user?.name || "Anonymous User"}
                        </CardTitle>
                        <CardDescription className="text-base text-muted-foreground">
                          {user?.email}
                        </CardDescription>
                        <div className="flex items-center space-x-4 pt-2">
                          <Badge variant="secondary" className="font-medium">
                            <Crown className="w-3 h-3 mr-1" />
                            Free Plan
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Member since{" "}
                            {user?.created_at
                              ? new Date(user.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Recently"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>Recent Activity</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Last 7 days
                      </Badge>
                    </div>
                    <CardDescription>Your latest chats and file uploads</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity, index) => (
                          <ActivityItem
                            key={activity.id}
                            {...activity}
                            isLast={index === recentActivity.length - 1}
                          />
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm">No recent activity</p>
                          <p className="text-xs">
                            Start a chat or upload a file to see your activity here
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Account Info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>Account Information</CardTitle>
                    </div>
                    <CardDescription>Your personal account details.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {MobileSettingsSections.map((section, index) => (
                        <div key={section.id}>
                          <div className="flex items-center justify-between py-3">
                            <p className="text-sm font-medium leading-none">{section.label}</p>
                            <p className="text-sm text-muted-foreground font-medium">
                              {section.getUserValue(user)}
                            </p>
                          </div>
                          {index < MobileSettingsSections.length - 1 && <Separator />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Subscription */}
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Crown className="h-5 w-5 text-primary" />
                      <CardTitle>Subscription</CardTitle>
                    </div>
                    <CardDescription>Manage your plan and billing.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-primary">Free Plan</p>
                        <p className="text-xs text-muted-foreground">Full access during beta</p>
                      </div>
                      <Badge className="font-medium bg-primary text-primary-foreground">
                        Active
                      </Badge>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Chats used</span>
                        <span className="font-medium">{stats?.totalChats || 0} / ∞</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Files uploaded</span>
                        <span className="font-medium">{stats?.totalFiles || 0} / ∞</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Storage</span>
                        <span className="font-medium">Unlimited</span>
                      </div>
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

                {/* Preferences */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>Preferences</CardTitle>
                    </div>
                    <CardDescription>Customize your experience</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Theme</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {resolvedTheme
                          ? resolvedTheme.charAt(0).toUpperCase() + resolvedTheme.slice(1)
                          : "System"}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Notifications</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Enabled
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Actions */}
                <Card className="border-destructive/50">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-destructive">Account Actions</CardTitle>
                    </div>
                    <CardDescription>Critical account options.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LogoutDialog
                      trigger={
                        <Button variant="destructive" className="w-full cursor-pointer" size="lg">
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
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
