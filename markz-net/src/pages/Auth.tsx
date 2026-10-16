import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { OfflineNotice } from "@/components/OfflineBadge";
import {
  Mail,
  Lock,
  LogIn,
  UserPlus,
  User,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Rocket,
} from "lucide-react";
import { hasAnyUsers, signIn, signUp } from "@/utils/localAuth";

/** مفتاح حفظ آخر بريد استُخدم لتسجيل الدخول على هذا الجهاز. */
const LAST_EMAIL_KEY = "markznet.lastEmail";

const getSafeNext = () => {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("next");
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
};

const getErrorMessage = (error: unknown) => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "";
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const Auth = () => {
  const initialParams = useMemo(
    () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null),
    [],
  );
  const startsInSignup = initialParams?.get("mode") === "signup";

  const [email, setEmail] = useState(() => initialParams?.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState(() => initialParams?.get("name") || "");
  const [isLogin, setIsLogin] = useState(!startsInSignup);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  /** أول تشغيل: لا حسابات على الجهاز — نعرض إعداد حساب المسؤول. */
  const [firstRun, setFirstRun] = useState(false);
  /** البريد محفوظ من مرة سابقة: نعرضه ثابتاً ونطلب كلمة المرور فقط. */
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const { toast } = useToast();

  // فحص أول تشغيل + استرجاع آخر بريد استُخدم على هذا الجهاز، أو تعبئة
  // بيانات رابط الدعوة (mode=signup&email=...&name=...).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const anyUsers = await hasAnyUsers();
        if (cancelled) return;
        if (!anyUsers) {
          setFirstRun(true);
          setIsLogin(false);
        }
      } catch (err) {
        console.error("تعذّر فحص الحسابات المحلية", err);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    const params = new URLSearchParams(window.location.search);
    const inviteMode = params.get("mode") === "signup";
    const inviteEmail = params.get("email");
    const inviteName = params.get("name");

    if (inviteEmail) setEmail(inviteEmail);
    if (inviteName) setDisplayName(inviteName);

    try {
      const saved = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (saved && !inviteEmail) {
        setRememberedEmail(saved);
        setEmail(saved);
      }
    } catch {
      /* التخزين المحلي غير متاح */
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const nextParam = getSafeNext();

  /** نسيان البريد المحفوظ للدخول بحساب آخر. */
  const useAnotherAccount = () => {
    try {
      window.localStorage.removeItem(LAST_EMAIL_KEY);
    } catch {
      /* تجاهل */
    }
    setRememberedEmail(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const saveLastEmail = (value: string) => {
    try {
      window.localStorage.setItem(LAST_EMAIL_KEY, value);
    } catch {
      /* تجاهل */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) throw new Error("يرجى إدخال البريد الإلكتروني");

      if (isLogin) {
        await signIn(normalizedEmail, password);
        // نحفظ البريد بعد نجاح الدخول فقط.
        saveLastEmail(normalizedEmail);
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك!" });
        window.location.replace(nextParam || "/");
        return;
      }

      // إنشاء حساب (أو إعداد أول حساب مسؤول عند أول تشغيل).
      if (password.trim().length < 6) {
        throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      }
      if (password.trim() !== confirmPassword.trim()) {
        throw new Error("كلمتا المرور غير متطابقتين");
      }
      await signUp({
        email: normalizedEmail,
        password: password.trim(),
        displayName,
      });
      saveLastEmail(normalizedEmail);
      if (firstRun) {
        toast({
          title: "تم إنشاء حساب المسؤول",
          description:
            "أهلاً بك في Markz Net (نسخة بلا إنترنت) — يمكنك الآن البدء بإدخال البيانات.",
        });
      } else {
        toast({
          title: "تم إنشاء الحساب",
          description: "تم تسجيل دخولك بالحساب الجديد مباشرة.",
        });
      }
      // الدخول تلقائي بعد إنشاء الحساب (لا بريد للتأكيد — كل شيء محلي).
      await signIn(normalizedEmail, password.trim());
      window.location.replace(nextParam || "/");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({
        title: "خطأ",
        description: message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setPassword("");
    setConfirmPassword("");
    if (!isLogin) return;
    setRememberedEmail(null);
  };

  if (bootstrapping) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-muted-foreground"
        dir="rtl"
      >
        جارٍ التحميل...
      </div>
    );
  }

  // نعرض البريد ثابتاً فقط في وضع تسجيل الدخول وعند وجود بريد محفوظ.
  const showRemembered = isLogin && !!rememberedEmail;
  const title = firstRun
    ? "إعداد النظام — إنشاء حساب المسؤول"
    : isLogin
      ? "تسجيل الدخول"
      : "إنشاء حساب جديد";
  const description = firstRun
    ? "هذا أول تشغيل للنظام على هذا الجهاز. أنشئ حساب المسؤول الأول — ستُخزَّن كل البيانات محليًا دون إنترنت."
    : isLogin
      ? "سجّل دخولك للوصول إلى السجل الرسمي والمسابقات وإدارة البيانات."
      : "املأ بيانات المستخدم الجديد — يعمل الحساب على هذا الجهاز مباشرة.";

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.2),transparent_34rem),radial-gradient(circle_at_bottom_left,hsl(var(--accent)/0.2),transparent_28rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.55))] flex items-center justify-center p-4"
      dir="rtl"
    >
      <Card className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border-white/70 bg-card/92 shadow-2xl shadow-primary/10 backdrop-blur md:grid-cols-[0.95fr_1.05fr]">
        <div className="relative hidden min-h-[34rem] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-emerald-700 to-teal-950 p-8 text-primary-foreground md:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.22),transparent_12rem),radial-gradient(circle_at_80%_75%,rgba(251,191,36,.18),transparent_10rem)]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-amber-200 ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5" />
              Markz Net — نسخة بلا إنترنت
            </div>
            <h2 className="mt-5 text-3xl font-black leading-relaxed text-white">
              Markz Net — نسخة بلا إنترنت: بياناتك تبقى على جهازك.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-7 text-white/75">
              كل البيانات — الحسابات والطلاب والمسابقات والمتابعة الشهرية — مخزّنة في قاعدة بيانات
              محلية على هذا الجهاز. لا سحابة ولا اتصال خارجي.
            </p>
          </div>

          <div className="relative z-10 grid gap-3">
            {[
              "يعمل بلا إنترنت تمامًا (شبكة محلية أو جهاز واحد)",
              "بيانات كل حساب معزولة ومحمية بكلمة مرور",
              "إدارة مستخدمين وصلاحيات ونمط اطلاع للقراءة فقط",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-2xl bg-white/10 p-3 text-sm ring-1 ring-white/15"
              >
                <ShieldCheck className="h-4 w-4 text-amber-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-3xl bg-primary/5 p-3 ring-1 ring-primary/10">
              <img src={logo} alt="الشعار" className="h-20 w-auto" />
            </div>
            <div>
              <h1 className="text-xl font-black text-primary">Markz Net — نسخة بلا إنترنت</h1>
              <p className="mt-0.5 text-[11px] font-semibold text-primary/70">
                نظام إدارة حلقات ومسابقات القرآن الكريم — قسم القرآن الكريم
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>

          <OfflineNotice className="mt-5" />

          {firstRun && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/10 p-3 text-xs leading-6 text-amber-900 dark:text-amber-200">
              <Rocket className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                أول حساب تُنشئه يصبح <strong>حساب المسؤول</strong> تلقائيًا، ومنه تُدار بقية
                الحسابات والصلاحيات.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {showRemembered ? (
              // البريد محفوظ: يظهر مكتوباً ولا يُطلب إدخاله مجدداً.
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-semibold" dir="ltr">
                    {rememberedEmail}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={useAnotherAccount}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  title="الدخول بحساب آخر"
                >
                  <X className="h-3 w-3" /> تغيير
                </button>
              </div>
            ) : (
              <>
                {!isLogin && (
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="الاسم الكامل"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-12 rounded-2xl pr-10"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="البريد الإلكتروني"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-2xl pr-10"
                    required
                    dir="ltr"
                    autoComplete="email"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl pl-10 pr-10"
                required
                minLength={6}
                dir="ltr"
                autoComplete={isLogin ? "current-password" : "new-password"}
                autoFocus={showRemembered}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {!isLogin && (
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="تأكيد كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 rounded-2xl pr-10"
                  required
                  minLength={6}
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-2xl shadow-lg shadow-primary/20"
              disabled={loading}
            >
              {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {loading
                ? "جارٍ المعالجة..."
                : isLogin
                  ? "تسجيل الدخول"
                  : firstRun
                    ? "إنشاء حساب المسؤول والبدء"
                    : "إنشاء حساب"}
            </Button>
          </form>

          {!firstRun && (
            <div className="mt-4 text-center">
              <button
                onClick={switchMode}
                className="rounded-full px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
              >
                {isLogin ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل دخولك"}
              </button>
            </div>
          )}

          <div className="mt-5 rounded-2xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
            <strong className="text-foreground">تنبيه:</strong> لا تشارك كلمة مرورك مع أحد. يمكن
            للمسؤول إدارة الصلاحيات وإعادة تعيين كلمات المرور من صفحة المستخدمين. نسيت كلمة المرور؟
            راجع مسؤول النظام على هذا الجهاز.
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
