/**
 * Small compatibility layer so pages written against react-router-dom keep
 * working on TanStack Router. Only the handful of APIs this app uses.
 */
import {
  Link as RouterLink,
  useNavigate as useTanstackNavigate,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, ...props }, ref) => {
  const AnyLink = RouterLink as unknown as React.ComponentType<Record<string, unknown>>;
  return <AnyLink ref={ref} to={to} {...props} />;
});
Link.displayName = "Link";

export type NavigateOptions = { replace?: boolean };

export function useNavigate() {
  const navigate = useTanstackNavigate();
  return (to: string | number, options?: NavigateOptions) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") window.history.go(to);
      return;
    }
    navigate({ to, replace: options?.replace } as never);
  };
}

export function useLocation() {
  return useRouterState({ select: (state) => state.location });
}

export function useSearchParams(): [URLSearchParams] {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const params = new URLSearchParams();
  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  return [params];
}
