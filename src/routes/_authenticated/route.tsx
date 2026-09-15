import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the persisted session locally, so an authenticated user
    // can still open the offline-first registry without a network round trip.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen" dir="rtl">
      <AppSidebar />
      {/* AppSidebar is fixed on desktop; reserve its width so pages do not sit
          underneath it. The margin is removed on mobile where it becomes a drawer. */}
      <main className="min-h-screen min-w-0 md:mr-72">
        <Outlet />
      </main>
    </div>
  );
}
