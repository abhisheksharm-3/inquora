"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useChats } from "@/hooks/useChats";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Search, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { HistoryChatlistSkeletonItem } from "@/components/history/HistoryPageSkeletonLoader";
import { HistoryPageChatItem } from "@/components/history/HistoryPageChatItem";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PaginatedChatList } from "@/components/history/PaginatedChatList";

/**
 * Renders the user's chat history page with improved responsive design and cohesive UI.
 */
const HistoryPage = () => {
  const { chats, isLoading, isError, error, refetch } = useChats();
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search query to reduce filtering frequency
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Memoize filtered chats to prevent recalculation on every render
  const filteredChats = useMemo(() => {
    if (!Array.isArray(chats)) return [];
    if (!debouncedSearchQuery.trim()) return chats;

    const query = debouncedSearchQuery.toLowerCase().trim();
    return chats.filter((chat) => chat?.title?.toLowerCase().includes(query));
  }, [chats, debouncedSearchQuery]);

  // Debounced search handler to reduce filtering frequency
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const renderContent = () => {
    if (isError) {
      return (
        <div className="mt-8 md:mt-12 text-center">
          <div className="mx-auto max-w-md">
            <Alert
              variant="destructive"
              className="backdrop-blur-sm bg-destructive/10 border-destructive/30 rounded-xl"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm md:text-base font-semibold">
                Failed to load chats
              </AlertTitle>
              <AlertDescription className="text-xs md:text-sm mt-2 leading-relaxed">
                {error instanceof Error ? error.message : "An unexpected error occurred."}
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => refetch()}
              variant="secondary"
              className="mt-4 w-full sm:w-auto backdrop-blur-sm bg-secondary/80 hover:bg-secondary/90 h-11 min-w-[120px]"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <HistoryChatlistSkeletonItem key={i} />
          ))}
        </div>
      );
    }
    if (filteredChats.length === 0) {
      return (
        <div className="mt-8 md:mt-12 flex flex-col items-center text-center">
          <div className="mx-auto max-w-sm px-4 sm:px-6">
            <div className="p-6 md:p-8 rounded-2xl backdrop-blur-sm bg-card/60 border border-border/60 shadow-lg">
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-3">
                No Chats Found
              </h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
                {searchQuery
                  ? "No chats match your search. Try a different term."
                  : "You have no chats yet. Create one to get started."}
              </p>
              <Button
                asChild
                className="w-full sm:w-auto min-w-[140px] backdrop-blur-sm bg-primary hover:bg-primary/90 h-11"
              >
                <Link href="/choose">
                  <Plus className="mr-2 h-4 w-4" /> New Chat
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {/* Use virtualization for large lists (>20 items) */}
        {filteredChats.length > 20 ? (
          <PaginatedChatList chats={filteredChats} />
        ) : (
          filteredChats.map((chat) =>
            chat?.id ? <HistoryPageChatItem key={chat.id} chat={chat} /> : null,
          )
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {" "}
      {/* Adjust height to account for header and padding */}
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6 border-b border-border/20 fixed-header">
        {/* Header */}
        <div className="mb-6 md:mb-8 text-center search-container">
          <div className="mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-3 chat-title">
              Chat History
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
              Review, search, and manage your past conversations.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mx-auto max-w-md lg:max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              type="text"
              placeholder="Search by chat title..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="h-12 w-full pl-10 pr-4 text-sm md:text-base backdrop-blur-sm bg-background/60 border-border/60 focus:bg-background/80 focus:border-primary/60 transition-all rounded-xl"
            />
          </div>
        </div>
      </div>
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6 chat-list-scroll smooth-scroll">
          <div className="mx-auto w-full max-w-4xl">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
