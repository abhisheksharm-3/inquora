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
import { useChats } from "@/hooks/useChats";
import { useFiles } from "@/hooks/useFiles";
import { SettingsLoadingSkeleton } from "@/components/settings/SettingsLoadingSkeleton";
import { MobileSettingsSections } from "@/constants/SettingsData";
import {
  User,
  Crown,
  Shield,
  LogOut,
  MessageSquare,
  FileText,
  Activity,
  Calendar,
  TrendingUp,
  Clock,
  Zap,
  Settings,
  Palette,
  Bell,
} from "lucide-react";
import avatarImage from "@/assets/images/avatar.svg";
import { getUserInitials } from "@/utils/dashboard-utils";
import PricingDialog from "@/components/dashboard/PricingDialog";
import { useMemo } from "react";

/**
 * Enhanced settings page with comprehensive user statistics and activity insights
 */
const SettingsPage = () => {
  const { user, isLoading } = useUser();
  const { chats, isLoading: chatsLoading } = useChats();
  const { files, isLoading: filesLoading } = useFiles();

  // Calculate usage statistics
  const stats = useMemo(() => {
    if (chatsLoading || filesLoading) return null;

    const totalChats = chats.length;
    const totalFiles = files.length;

    // Calculate total messages across all chats (approximation since we don't have all messages)
    const estimatedMessages = chats.length * 5; // Rough estimate

    // Calculate recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentChats = chats.filter(
      (chat) => new Date(chat.created_at) > sevenDaysAgo,
    ).length;

    const recentFiles = files.filter(
      (file) => new Date(file.uploaded_at) > sevenDaysAgo,
    ).length;

    // Get file types breakdown
    const fileTypes = files.reduce(
      (acc, file) => {
        const type = file.type || "unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get account age in days
    const accountAge = user?.created_at
      ? Math.floor(
          (new Date().getTime() - new Date(user.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return {
      totalChats,
      totalFiles,
      estimatedMessages,
      recentChats,
      recentFiles,
      fileTypes,
      accountAge,
      mostActiveDay: "Today", // Simplified for now
    };
  }, [chats, files, chatsLoading, filesLoading, user]);

  // Get recent activity items
  const recentActivity = useMemo(() => {
    if (chatsLoading || filesLoading) return [];

    const activities = [
      ...chats.slice(0, 3).map((chat) => ({
        id: chat.id,
        type: "chat" as const,
        title: chat.title || "New Chat",
        timestamp: chat.created_at,
        icon: MessageSquare,
      })),
      ...files.slice(0, 3).map((file) => ({
        id: file.id,
        type: "file" as const,
        title: file.name,
        timestamp: file.uploaded_at,
        icon: FileText,
      })),
    ];

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 5);
  }, [chats, files, chatsLoading, filesLoading]);

  if (isLoading) {
    return <SettingsLoadingSkeleton isMobile={false} />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Scrollable Content Area - Full Page */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6 chat-list-scroll smooth-scroll">
          <div className="container mx-auto max-w-7xl space-y-8">
            {/* Enhanced Header Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-muted-foreground bg-clip-text text-transparent pb-2 md:text-5xl">
                    Account Settings
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    Manage your profile, track your activity, and customize your
                    Inquora experience.
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

            {/* Usage Statistics Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-primary/20">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.totalChats || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Chats
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-muted-foreground">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {stats?.recentChats || 0} this week
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-800 dark:from-blue-950 dark:to-blue-900">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-blue-200 dark:bg-blue-800">
                      <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.totalFiles || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Files Uploaded
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    {stats?.recentFiles || 0} this week
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:border-green-800 dark:from-green-950 dark:to-green-900">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-green-200 dark:bg-green-800">
                      <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.estimatedMessages || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Messages Sent
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-muted-foreground">
                    <Activity className="w-3 h-3 mr-1" />
                    Most active {stats?.mostActiveDay}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:border-purple-800 dark:from-purple-950 dark:to-purple-900">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-purple-200 dark:bg-purple-800">
                      <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.accountAge || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Days Active
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-muted-foreground">
                    <Crown className="w-3 h-3 mr-1" />
                    Free Plan Member
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Profile & Account Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Enhanced Profile Card */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
                  <CardHeader className="relative">
                    <div className="flex items-center space-x-6">
                      <div className="relative">
                        <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                          <AvatarImage src={avatarImage} alt="User Avatar" />
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
                              ? new Date(user.created_at).toLocaleDateString(
                                  "en-US",
                                  { month: "short", year: "numeric" },
                                )
                              : "Recently"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Recent Activity Card */}
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
                    <CardDescription>
                      Your latest chats and file uploads
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity, index) => (
                          <div key={activity.id}>
                            <div className="flex items-center space-x-4 py-3">
                              <div
                                className={`p-2 rounded-full ${
                                  activity.type === "chat"
                                    ? "bg-primary/20 text-primary"
                                    : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                                }`}
                              >
                                <activity.icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">
                                  {activity.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {activity.type === "chat"
                                    ? "Started chat"
                                    : "Uploaded file"}{" "}
                                  •{" "}
                                  {new Date(
                                    activity.timestamp,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(
                                  activity.timestamp,
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            {index < recentActivity.length - 1 && <Separator />}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm">No recent activity</p>
                          <p className="text-xs">
                            Start a chat or upload a file to see your activity
                            here
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
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
                            <div className="text-sm text-muted-foreground font-medium">
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

              {/* Right Column - Subscription, Preferences & Actions */}
              <div className="space-y-6">
                {/* Enhanced Subscription Card */}
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Crown className="h-5 w-5 text-primary" />
                      <CardTitle>Subscription</CardTitle>
                    </div>
                    <CardDescription>
                      Manage your current plan and billing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-primary">
                          Free Plan
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Full access during beta
                        </p>
                      </div>
                      <Badge className="font-medium bg-primary text-primary-foreground">
                        Active
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Chats used
                        </span>
                        <span className="font-medium">
                          {stats?.totalChats || 0} / ∞
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Files uploaded
                        </span>
                        <span className="font-medium">
                          {stats?.totalFiles || 0} / ∞
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Storage used
                        </span>
                        <span className="font-medium">Unlimited</span>
                      </div>
                    </div>

                    <PricingDialog
                      trigger={
                        <Button
                          variant="outline"
                          className="w-full cursor-pointer"
                          size="lg"
                        >
                          <Crown className="mr-2 h-4 w-4" />
                          View Plan Details
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>

                {/* Preferences Card */}
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
                        System
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Notifications
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Enabled
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Actions Card */}
                <Card className="border-destructive/50">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-destructive">
                        Account Actions
                      </CardTitle>
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
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
