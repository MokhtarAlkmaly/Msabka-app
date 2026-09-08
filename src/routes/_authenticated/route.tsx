import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LOCAL_USER_ID } from "@/hooks/useAuth";

// Local-only mode: there's no cloud session to check anymore, so this route
// guard always passes. Kept as a route (rather than removed) so the
// generated route tree and existing route paths don't need to change.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    return { user: { id: LOCAL_USER_ID } };
  },
  component: () => <Outlet />,
});
