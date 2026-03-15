"use client";

import { LucideIcon, MessageSquare, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ActivityItemProps {
    id: string;
    type: "chat" | "file";
    title: string;
    timestamp: string;
    icon?: LucideIcon;
    isLast?: boolean;
}

export function ActivityItem({
    type,
    title,
    timestamp,
    icon: Icon,
    isLast = false,
}: ActivityItemProps) {
    const DefaultIcon = type === "chat" ? MessageSquare : FileText;
    const ActivityIcon = Icon || DefaultIcon;

    const date = new Date(timestamp);

    return (
        <div>
            <div className="flex items-center space-x-4 py-3">
                <div
                    className={`p-2 rounded-full ${type === "chat"
                            ? "bg-primary/20 text-primary"
                            : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                        }`}
                >
                    <ActivityIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{title}</p>
                    <p className="text-xs text-muted-foreground">
                        {type === "chat" ? "Started chat" : "Uploaded file"} •{" "}
                        {date.toLocaleDateString()}
                    </p>
                </div>
                <div className="text-xs text-muted-foreground">
                    {date.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </div>
            </div>
            {!isLast && <Separator />}
        </div>
    );
}
