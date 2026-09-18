import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@/lib/router-compat";
import {
  ArrowRight,
  Users as UsersIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  Shield,
  Search,
  RefreshCw,
  UserCheck,
  Crown,
  UserPlus,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { listAllUsers, grantAccess, revokeAccess, setUserRole, type AppUser } from "@/utils/users";

/** قراءة رسالة/رمز الخطأ بأمان دون استعمال any. */
const errInfo = (error: unknown): { message: string; code: string } => {
  const e = (error ?? {}) as { message?: unknown; code?: unknown };
  return {
    message: typeof e.message === "string" ? e.message : "",
    code: typeof e.code === "string" ? e.code : "",
  };
};

const Users = () => {
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading, refreshAccess } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleTarget, setRoleTarget] = useState<AppUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listAllUsers());
    } catch (error: unknown) {
      console.error("تعذّر تحميل قائمة المستخدمين:", error);
      const { message, code } = errInfo(error);
      toast({
        title: "تعذّر تحميل قائمة المستخدمين",
        description:
          message.includes("غير مصرح") || code === "42501"
            ? "هذه الصفحة للمسؤول فقط."
            : "تأكد من تنفيذ ملف SQL الخاص بنظام المستخدمين في Supabase.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, isAdmin, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.display_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.is_admin).length,
      granted: users.filter((u) => u.granted).length,
    }),
    [users],
  );

  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams({ mode: "signup" });
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    if (email) params.set("email", email);
    if (name) params.set("name", name);
    return `${window.location.origin}/auth?${params.toString()}`;
  }, [inviteEmail, inviteName]);

  const copyInviteLink = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "البريد مطلوب",
        description: "اكتب بريد المستخدم لتجهيز رابط التسجيل.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "تم نسخ رابط التسجيل",
        description: "أرسل الرابط للمستخدم ليكمل إنشاء حسابه بنفسه.",
      });
    } catch {
      toast({
        title: "تعذّر النسخ التلقائي",
        description: "يمكنك تحديد الرابط ونسخه يدوياً.",
        variant: "destructive",
      });
    }
  };

  const toggleAccess = async (target: AppUser) => {
    setBusyId(target.id);
    try {
      if (target.granted) {
        await revokeAccess(target.id);
        toast({
          title: "تم إيقاف الاطلاع",
          description: `لم يعد ${target.display_name || target.email} يرى بياناتك.`,
        });
      } else {
        await grantAccess(target.id, "read");
        toast({
          title: "تم السماح بالاطلاع",
          description: `يستطيع ${target.display_name || target.email} الآن عرض بياناتك (قراءة فقط).`,
        });
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === target.id
            ? { ...u, granted: !target.granted, access_level: target.granted ? null : "read" }
            : u,
        ),
      );
      await refreshAccess();
    } catch (error: unknown) {
      toast({
        title: "تعذّر تنفيذ العملية",
        description: errInfo(error).message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const applyRoleChange = async () => {
    if (!roleTarget) return;
    const target = roleTarget;
    setRoleTarget(null);
    setBusyId(target.id);
    try {
      await setUserRole(target.id, !target.is_admin);
      toast({
        title: target.is_admin ? "تم إنزال الصلاحية" : "تمت الترقية إلى مسؤول",
        description: `${target.display_name || target.email}`,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, is_admin: !target.is_admin } : u)),
      );
    } catch (error: unknown) {
      toast({
        title: "تعذّر تغيير الصلاحية",
        description: errInfo(error).message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  // ===== غير مسؤول =====
  if (!authLoading && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md rounded-[2rem] border border-white/70 bg-card/90 p-8 text-center shadow-xl">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-bold">هذه الصفحة للمسؤول فقط</h1>
          <p className="mt-2 text-sm text-muted-foreground">لا تملك صلاحية إدارة المستخدمين.</p>
          <Link to="/">
            <Button className="mt-5 gap-1">
              <ArrowRight className="h-4 w-4" /> العودة للرئيسية
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <header className="mx-3 mt-3 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 px-4 py-5 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1 text-primary-foreground">
                <ArrowRight className="h-4 w-4" /> رجوع
              </Button>
            </Link>
            <img src={logo} alt="الشعار" className="h-16 w-auto" />
            <div className="w-20" />
          </div>
          <div className="text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
              <UsersIcon className="h-6 w-6" /> إدارة المستخدمين
            </h1>
            <p className="mt-1 text-sm opacity-90">
              كل مستخدم له بياناته الخاصة — وأنت تتحكم بمن يرى بياناتك
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl space-y-4 px-3 py-5 sm:px-4 sm:py-7">
        {/* بطاقات إحصائية */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[1.5rem] border border-white/70 bg-card/90 p-4 text-center shadow-lg shadow-primary/5">
            <div className="text-xs text-muted-foreground">إجمالي المستخدمين</div>
            <div className="text-lg font-bold text-primary">{stats.total}</div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-card/90 p-4 text-center shadow-lg shadow-primary/5">
            <div className="text-xs text-muted-foreground">المسؤولون</div>
            <div className="text-lg font-bold text-amber-600">{stats.admins}</div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-card/90 p-4 text-center shadow-lg shadow-primary/5">
            <div className="text-xs text-muted-foreground">مسموح لهم بالاطلاع</div>
            <div className="text-lg font-bold text-emerald-600">{stats.granted}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو البريد الإلكتروني"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-2xl pr-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setInviteOpen(true)} className="gap-1 rounded-xl">
              <UserPlus className="h-4 w-4" /> إضافة مستخدم
            </Button>
            <Button
              variant="outline"
              onClick={() => void load()}
              className="gap-1 rounded-xl"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">لا يوجد مستخدمون مطابقون</div>
        ) : (
          <div className="overflow-x-auto rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">البريد الإلكتروني</th>
                  <th className="px-3 py-2 text-center">الصلاحية</th>
                  <th className="px-3 py-2 text-center">عدد الطلاب</th>
                  <th className="px-3 py-2 text-center">الاطلاع على بياناتي</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, index) => {
                  const isMe = u.id === user?.id;
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} className="border-t border-border/60 hover:bg-primary/5">
                      <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2 font-semibold">
                        <div className="flex items-center gap-2">
                          {u.display_name || "—"}
                          {isMe && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              أنت
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                        {u.email || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            <Crown className="h-3 w-3" /> مسؤول
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            مستخدم
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">{u.students_count}</td>
                      <td className="px-3 py-2 text-center">
                        {isMe ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : u.granted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            <UserCheck className="h-3 w-3" /> مسموح
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">موقوف</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {!isMe && (
                            <>
                              <Button
                                size="sm"
                                variant={u.granted ? "outline" : "default"}
                                className="gap-1"
                                disabled={busy}
                                onClick={() => void toggleAccess(u)}
                              >
                                {u.granted ? (
                                  <>
                                    <EyeOff className="h-3.5 w-3.5" /> أوقف الاطلاع
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-3.5 w-3.5" /> اسمح بالاطلاع
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1"
                                disabled={busy}
                                onClick={() => setRoleTarget(u)}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {u.is_admin ? "إلغاء المسؤول" : "ترقية لمسؤول"}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          ملاحظة: «اسمح بالاطلاع» يمنح المستخدم عرض بياناتك في وضع <strong>قراءة فقط</strong>؛ لا
          يستطيع التعديل أو الحذف. بيانات كل مستخدم تبقى خاصة به ولا يراها غيره.
        </p>
      </div>

      {/* إضافة/دعوة مستخدم جديد */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> إضافة مستخدم جديد
            </DialogTitle>
            <DialogDescription>
              حفاظاً على الأمان لا تُنشأ كلمات المرور من حساب المسؤول. أرسل هذا الرابط للمستخدم
              ليكمل إنشاء حسابه، وبعد أول دخول سيظهر تلقائياً في القائمة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">اسم المستخدم</label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="مثال: محمد أحمد"
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">البريد الإلكتروني</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="h-11 rounded-2xl"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-semibold">
                <LinkIcon className="h-4 w-4" /> رابط التسجيل
              </label>
              <Input
                value={inviteLink}
                readOnly
                className="h-11 rounded-2xl bg-muted/70"
                dir="ltr"
              />
              <p className="text-xs leading-6 text-muted-foreground">
                إذا كنت تريد تجربة الرابط على نفس الجهاز، افتحه في نافذة خاصة أو بعد تسجيل الخروج
                حتى لا ينتقل بك النظام لحسابك الحالي.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              إغلاق
            </Button>
            <Button onClick={() => void copyInviteLink()} className="gap-2">
              <Copy className="h-4 w-4" /> نسخ رابط التسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد تغيير الصلاحية */}
      <Dialog open={!!roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {roleTarget?.is_admin ? "إلغاء صلاحية المسؤول" : "ترقية إلى مسؤول"}
            </DialogTitle>
            <DialogDescription>
              {roleTarget?.is_admin
                ? `سيفقد ${roleTarget?.display_name || roleTarget?.email} صلاحيات المسؤول وقائمة المستخدمين.`
                : `سيحصل ${roleTarget?.display_name || roleTarget?.email} على صلاحية المسؤول: عرض كل المستخدمين وبياناتهم.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRoleTarget(null)}>
              إلغاء
            </Button>
            <Button onClick={() => void applyRoleChange()}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
