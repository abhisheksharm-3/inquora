"use client";

import { LucideIcon, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  subtitle?: string;
  subtitleIcon?: LucideIcon;
  colorScheme?: "primary" | "blue" | "green" | "purple" | "orange";
}

const colorSchemes = {
  primary: {
    border: "border-primary/20",
    bg: "bg-gradient-to-br from-primary/5 to-primary/10",
    iconBg: "bg-primary/20",
    iconText: "text-primary",
  },
  blue: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
    iconBg: "bg-blue-200 dark:bg-blue-800",
    iconText: "text-blue-600 dark:text-blue-400",
  },
  green: {
    border: "border-green-200 dark:border-green-800",
    bg: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
    iconBg: "bg-green-200 dark:bg-green-800",
    iconText: "text-green-600 dark:text-green-400",
  },
  purple: {
    border: "border-purple-200 dark:border-purple-800",
    bg: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900",
    iconBg: "bg-purple-200 dark:bg-purple-800",
    iconText: "text-purple-600 dark:text-purple-400",
  },
  orange: {
    border: "border-orange-200 dark:border-orange-800",
    bg: "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900",
    iconBg: "bg-orange-200 dark:bg-orange-800",
    iconText: "text-orange-600 dark:text-orange-400",
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  subtitleIcon: SubtitleIcon = TrendingUp,
  colorScheme = "primary",
}: StatCardProps) {
  const colors = colorSchemes[colorScheme];

  return (
    <Card className={`border-2 ${colors.border} ${colors.bg}`}>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-full ${colors.iconBg}`}>
            <Icon className={`h-6 w-6 ${colors.iconText}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
        {subtitle && (
          <div className="mt-4 flex items-center text-xs text-muted-foreground">
            <SubtitleIcon className="w-3 h-3 mr-1" />
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
