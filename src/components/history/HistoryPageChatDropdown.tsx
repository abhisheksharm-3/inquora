import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { HistoryPageDropdownActions } from "@/constants/HistoryPage";
import { TypeHistoryPageChatDropdownProps } from "@/types/TypeUi";

/**
 * A responsive dropdown menu for chat item actions with improved mobile touch targets.
 */
export const HistorypageChatDropdown = ({ chat, file }: TypeHistoryPageChatDropdownProps) => (
  <div className="absolute top-4 right-4 md:top-1/2 md:right-4 md:-translate-y-1/2 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-background/60 backdrop-blur-sm border border-transparent hover:border-border/60 rounded-lg"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-48 backdrop-blur-sm bg-popover/95 border-border/60 shadow-lg"
        sideOffset={8}
      >
        {HistoryPageDropdownActions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={(e) => action.handler(e, chat, file ?? undefined)}
            className="cursor-pointer py-3 px-4 hover:bg-accent/60 focus:bg-accent/60 rounded-md"
          >
            <action.icon className="mr-3 h-4 w-4" />
            <span className="text-sm font-medium">{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);