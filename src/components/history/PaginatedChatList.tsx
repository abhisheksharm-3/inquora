"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { TypeChatWithFile } from "@/types/database";
import { HistoryPageChatItem } from "./HistoryPageChatItem";

interface PaginatedChatListProps {
  chats: TypeChatWithFile[];
}

const ITEMS_PER_PAGE = 20;

/**
 * Optimized list component that renders chat items incrementally as user scrolls.
 * Uses intersection observer for infinite scrolling with performance optimization.
 */
export const PaginatedChatList = memo(
  ({ chats }: PaginatedChatListProps) => {
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load more items when user scrolls near the bottom
    const loadMore = useCallback(() => {
      if (isLoading || visibleCount >= chats.length) return;

      setIsLoading(true);
      // Simulate loading delay and batch update
      setTimeout(() => {
        setVisibleCount((prev) =>
          Math.min(prev + ITEMS_PER_PAGE, chats.length),
        );
        setIsLoading(false);
      }, 100);
    }, [chats.length, isLoading, visibleCount]);

    // Intersection observer for infinite scrolling
    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoading) {
            loadMore();
          }
        },
        { threshold: 0.1, rootMargin: "100px" },
      );

      const currentLoader = loaderRef.current;
      if (currentLoader) {
        observer.observe(currentLoader);
      }

      return () => {
        if (currentLoader) {
          observer.unobserve(currentLoader);
        }
      };
    }, [loadMore, isLoading]);

    // Reset visible count when chats change (e.g., from search)
    useEffect(() => {
      setVisibleCount(Math.min(ITEMS_PER_PAGE, chats.length));
    }, [chats]);

    const visibleChats = chats.slice(0, visibleCount);
    const hasMore = visibleCount < chats.length;

    return (
      <div ref={containerRef} className="space-y-4 h-full">
        {visibleChats.map((chat) =>
          chat?.id ? (
            <div key={chat.id}>
              <HistoryPageChatItem chat={chat} />
            </div>
          ) : null,
        )}

        {/* Loading trigger element */}
        {hasMore && (
          <div
            ref={loaderRef}
            className="flex items-center justify-center py-4"
          >
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading more chats...</span>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                Scroll to load more ({chats.length - visibleCount} remaining)
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

PaginatedChatList.displayName = "PaginatedChatList";
