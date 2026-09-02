"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/**
 * A client-side provider that sets up the React Query context.
 *
 * This component should wrap any part of the application that needs data fetching
 * capabilities. It ensures that a single `QueryClient` instance is created and
 * maintained for the lifetime of the component, preventing data leakage between
 * users in server-rendered apps and providing a stable cache.
 *
 * @param {object} props - The properties for the component.
 * @param {ReactNode} props.children - The child components that will have access to the React Query context.
 * @returns {JSX.Element} The QueryClientProvider wrapping the children and including Devtools.
 */
function QueryProvider({ children }: { children: ReactNode }) {
  // Use useState to create the QueryClient instance.
  // This ensures the client is created only once per component lifecycle
  // and is stable across re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Set a default stale time of 1 minute to reduce unnecessary refetching.
            staleTime: 1000 * 60,
            // Disable refetching when the window regains focus.
            refetchOnWindowFocus: false,
            // Retry failed queries once by default.
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default QueryProvider;
