import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

const SIDEBAR_QUERY_KEY = ["sidebar", "mobile", "state"];

export const useSidebarState = () => {
  const queryClient = useQueryClient();

  const { data: state } = useQuery({
    queryKey: SIDEBAR_QUERY_KEY,
    queryFn: () => ({ isOpen: false }),
    staleTime: Infinity, // Never stale
    gcTime: Infinity, // Never garbage collect
  });

  const updateState = (updater: (prev: { isOpen: boolean }) => { isOpen: boolean }) => {
    queryClient.setQueryData(SIDEBAR_QUERY_KEY, updater);
  };

  const openSidebar = () => {
    updateState((prev) => ({ ...prev, isOpen: true }));
  };

  const closeSidebar = () => {
    updateState((prev) => ({ ...prev, isOpen: false }));
  };

  const toggleSidebar = () => {
    updateState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  };

  return {
    isOpen: state?.isOpen ?? false,
    openSidebar,
    closeSidebar,
    toggleSidebar,
  };
};
