import { useState } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import {
  Users,
  Trophy,
  BookOpen,
  CalendarDays,
  Search,
  Award,
  ScrollText,
  Sparkles,
  HeartHandshake,
  Receipt,
  Camera,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Globe2,
  Medal,
  UserCog,
  Settings,
  Eye,
  EyeOff,
  Link2,
  Inbox,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { OfflineBadge } from "@/components/OfflineBadge";
import { BRAND_NAME, BRAND_OFFLINE_TAG, BRAND_SIGNATURE } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";

export const AppSidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { signOut, isAdmin, sharedWithMe, viewAs, setViewAs } = useAuth();
  const pathname = location.pathname || "/";

  // أصحاب البيانات الذين سمحوا لي بالاطلاع (يُستثنى حسابي أنا).
  const shareableOwners = sharedWithMe;

  const enterViewAs = (ownerId: string, name: string, email: string | null) => {
    setMobileOpen(false);
    setViewAs({ id: ownerId, name, email });
    if (typeof window !== "undefined") window.location.reload();
  };

  const exitViewAs = () => {
    setMobileOpen(false);
    setViewAs(null);
    if (typeof window !== "undefined") window.location.reload();
  };

  const navItems = [
    {
      to: "/",
      label: "سجل الطلاب الرسمي",
      icon: GraduationCap,
      badge: "الرئيسية",
      color: "text-emerald-400",
    },
    {
      to: "/competition",
      label: "المسابقة الرمضانية",
      icon: BookOpen,
      color: "text-amber-400",
    },
    {
      to: "/monthly",
      label: "المتابعة الشهرية",
      icon: CalendarDays,
      color: "text-teal-300",
    },
    {
      to: "/monthly-search",
      label: "بحث المتابعة الشهرية",
      icon: Search,
      color: "text-sky-300",
    },
    {
      to: "/teacher-links",
      label: "روابط المعلمين والمعلمات",
      icon: Link2,
      color: "text-violet-300",
    },
    {
      to: "/submissions",
      label: "وارد المعلمين والمعلمات",
      icon: Inbox,
      color: "text-amber-300",
    },
    {
      to: "/halaqat",
      label: "إدارة الحلقات",
      icon: Users,
      color: "text-cyan-300",
    },
    {
      to: "/teachers",
      label: "المعلمين والمعلمات والإكراميات",
      icon: Users,
      color: "text-indigo-300",
    },
    {
      to: "/awards",
      label: "الجوائز والتكريم",
      icon: Award,
      color: "text-yellow-400",
    },
    {
      to: "/certificates",
      label: "شهادات التقدير",
      icon: ScrollText,
      color: "text-emerald-300",
    },
    {
      to: "/internal-competitions",
      label: "المسابقات الداخلية",
      icon: Medal,
      color: "text-amber-300",
    },
    {
      to: "/external-competitions",
      label: "المسابقات الخارجية",
      icon: Globe2,
      color: "text-cyan-300",
    },
    {
      to: "/khatimat",
      label: "كشف الخاتمين والخاتمات",
      icon: Sparkles,
      color: "text-amber-400",
    },
    {
      to: "/donors",
      label: "الداعمون",
      icon: HeartHandshake,
      color: "text-rose-300",
    },
    {
      to: "/expenses",
      label: "المصروفات",
      icon: Receipt,
      color: "text-red-300",
    },
    {
      to: "/search",
      label: "البحث الشامل بالسجل",
      icon: Trophy,
      color: "text-blue-300",
    },
    {
      to: "/media",
      label: "الوسائط والصور",
      icon: Camera,
      color: "text-violet-300",
    },
    {
      to: "/settings",
      label: "إدارة الإعدادات",
      icon: Settings,
      color: "text-emerald-200",
    },
    // تظهر للمسؤول فقط
    ...(isAdmin
      ? [
          {
            to: "/users",
            label: "إدارة المستخدمين",
            icon: UserCog,
            badge: "المسؤول",
            color: "text-fuchsia-300",
          },
        ]
      : []),
  ];

  const isActive = (path: string) => {
    if (path === "/" && (pathname === "/" || pathname === "")) return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Menu Trigger Button */}
      <div className="fixed top-3 right-3 z-50 md:hidden print:hidden">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="h-10 w-10 rounded-2xl bg-emerald-900 text-white shadow-xl hover:bg-emerald-800 p-0 flex items-center justify-center ring-1 ring-white/20"
          aria-label="القائمة"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container (Right side in RTL) */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-40 flex w-72 flex-col bg-gradient-to-b from-emerald-950 via-teal-950 to-slate-950 text-white shadow-2xl transition-transform duration-300 ease-in-out md:translate-x-0 print:hidden border-l border-white/10 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        dir="rtl"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center border-b border-white/10 p-4 text-center">
          <div className="relative mb-2 rounded-2xl bg-white/95 p-2 shadow-lg ring-2 ring-amber-400/30">
            <img
              src={logo}
              alt="Markz Net — نسخة بلا إنترنت"
              className="h-14 w-14 object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 ring-1 ring-white/15">
            <Sparkles className="h-3 w-3" />
            {BRAND_NAME} · {BRAND_OFFLINE_TAG}
          </div>
          <h2 className="mt-1.5 text-base font-black tracking-tight text-white">
            قسم القرآن الكريم
          </h2>
          <p className="text-[11px] text-white/60">نظام الإدارة وسجل الطلاب الشامل</p>

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            <OfflineBadge tone="glass" />
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
            صفحات النظام
          </div>

          {navItems.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-white/20 translate-x-[-2px]"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`rounded-lg p-1.5 transition-colors ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/70 group-hover:bg-white/15 group-hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-white" : item.color}`} />
                  </div>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300 ring-1 ring-amber-400/40">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer info & Logout */}
        <div className="border-t border-white/10 p-3 bg-black/20">
          {/* الاطلاع على بيانات من سمح لي */}
          {(viewAs || shareableOwners.length > 0) && (
            <div className="mb-2 rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
              {viewAs ? (
                <>
                  <p className="mb-1.5 px-1 text-[10px] font-bold text-amber-300">
                    تطالع بيانات: {viewAs.name}
                  </p>
                  <Button
                    onClick={exitViewAs}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center gap-2 rounded-lg text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>العودة لبياناتي</span>
                  </Button>
                </>
              ) : (
                <>
                  <p className="mb-1.5 px-1 text-[10px] font-bold text-white/50">
                    مسموح لك بالاطلاع على
                  </p>
                  {shareableOwners.map((owner) => (
                    <Button
                      key={owner.owner_id}
                      onClick={() => enterViewAs(owner.owner_id, owner.name, owner.email)}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 rounded-lg text-sky-200 hover:bg-sky-500/20 hover:text-sky-100"
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      <span className="truncate">{owner.name}</span>
                    </Button>
                  ))}
                </>
              )}
            </div>
          )}

          <Button
            onClick={() => {
              setMobileOpen(false);
              void signOut().then(() => {
                window.location.replace("/auth");
              });
            }}
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 rounded-xl text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
          >
            <LogOut className="h-4 w-4" />
            <span>تسجيل الخروج</span>
          </Button>
          <p className="mt-2 text-center text-[10px] text-white/40">{BRAND_SIGNATURE}</p>
        </div>
      </aside>
    </>
  );
};
