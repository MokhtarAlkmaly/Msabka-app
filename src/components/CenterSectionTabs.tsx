import { useEffect, useRef } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { centerSections, getCenterSection } from "@/lib/center-sections";

/** Route links styled as tabs: each section has a bookmarkable, independent page. */
export function CenterSectionTabs() {
  const { pathname } = useLocation();
  const activeSection = getCenterSection(pathname);
  const activeLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeLink.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSection.id]);

  return (
    <header className="border-b bg-background px-4 pb-3 pt-4 md:px-6 print:hidden">
      <p className="mb-3 pr-12 text-sm font-bold text-muted-foreground md:pr-0">
        أقسام مركز إنماء الأهلي الخيري
      </p>
      <nav aria-label="أقسام المركز" className="overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-2">
          {centerSections.map((section) => {
            const active = activeSection.id === section.id;
            const Icon = section.icon;
            return (
              <Link
                key={section.id}
                to={section.to}
                ref={active ? activeLink : undefined}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex-1 ${
                  active
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {section.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
