import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
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
  KeyRound,
  Sparkles,
} from "lucide-react";

/** مفتاح حفظ آخر بريد استُخدم لتسجيل الدخول على هذا الجهاز. */
const LAST_EMAIL_KEY = "msabka.lastEmail";

const getSafeNext = () => {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("next");
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
};

const isRecoveryLink = () => {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return search.get("type") === "recovery" || hash.get("type") === "recovery";
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
  const [isRecovery, setIsRecovery] = useState(isRecoveryLink);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  /** البريد محفوظ من مرة سابقة: نعرضه ثابتاً ونطلب كلمة المرور فقط. */
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const { toast } = useToast();

  // استرجاع آخر بريد استُخدم على هذا الجهاز، أو تعبئة بيانات رابط الدعوة.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteMode = params.get("mode") === "signup";
    const inviteEmail = params.get("email");
    const inviteName = params.get("name");

    if (inviteMode) {
      setIsLogin(false);
      setRememberedEmail(null);
      if (inviteEmail) setEmail(inviteEmail);
      if (inviteName) setDisplayName(inviteName);
      return;
    }

    try {
      const saved = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) {
        setRememberedEmail(saved);
        setEmail(saved);
      }
    } catch {
      /* التخزين المحلي غير متاح */
    }
  }, []);

  // عند فتح رابط استعادة كلمة المرور من Supabase نعرض نموذج تعيين كلمة جديدة.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setIsLogin(true);
        setRememberedEmail(null);
        setPassword("");
        setConfirmPassword("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const nextParam = getSafeNext();
  const emailRedirect = nextParam
    ? `${window.location.origin}/auth?next=${encodeURIComponent(nextParam)}`
    : `${window.location.origin}/auth`;

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

  const handlePasswordRecovery = async () => {
    const newPassword = password.trim();
    if (newPassword.length < 6) {
      toast({
        title: "كلمة المرور قصيرة",
        description: "اكتب كلمة مرور من 6 أحرف على الأقل.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword.trim()) {
      toast({
        title: "كلمتا المرور غير متطابقتين",
        description: "تأكد من كتابة كلمة المرور نفسها في خانة التأكيد.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    toast({
      title: "تم تحديث كلمة المرور",
      description: "يمكنك الآن متابعة استخدام النظام بكلمة المرور الجديدة.",
    });
    window.location.replace(nextParam || "/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRecovery) {
        await handlePasswordRecovery();
        return;
      }

      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) throw new Error("يرجى إدخال البريد الإلكتروني");

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        // نحفظ البريد بعد نجاح الدخول فقط.
        saveLastEmail(normalizedEmail);
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك!" });
      } else {
        if (password.trim().length < 6) {
          throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        }
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: password.trim(),
          options: {
            emailRedirectTo: emailRedirect,
            data: { display_name: displayName.trim() || normalizedEmail.split("@")[0] },
          },
        });
        if (error) throw error;
        saveLastEmail(normalizedEmail);
        toast({
          title: "تم إنشاء الحساب",
          description:
            "إن كان تأكيد البريد مفعّلاً فافتح رسالة التأكيد، وإلا يمكنك تسجيل الدخول مباشرة.",
        });
        setIsLogin(true);
        setPassword("");
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({
        title: "خطأ",
        description:
          message === "Invalid login credentials"
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            : message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = normalizeEmail(email || rememberedEmail || "");
    if (!normalizedEmail) {
      toast({
        title: "اكتب البريد أولاً",
        description: "أدخل بريدك الإلكتروني ثم اضغط نسيت كلمة المرور.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: emailRedirect,
      });
      if (error) throw error;
      toast({
        title: "تم إرسال رابط الاستعادة",
        description: "افتح بريدك الإلكتروني واتبع الرابط لتعيين كلمة مرور جديدة.",
      });
    } catch (error: unknown) {
      toast({
        title: "تعذّر إرسال رابط الاستعادة",
        description: getErrorMessage(error) || "تحقق من البريد الإلكتروني ثم حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setIsRecovery(false);
    setPassword("");
    setConfirmPassword("");
    if (!isLogin) return;
    setRememberedEmail(null);
  };

  // نعرض البريد ثابتاً فقط في وضع تسجيل الدخول وعند وجود بريد محفوظ.
  const showRemembered = isLogin && !isRecovery && !!rememberedEmail;
  const title = isRecovery ? "تعيين كلمة مرور جديدة" : isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد";
  const description = isRecovery
    ? "اكتب كلمة مرور قوية لحسابك ثم احفظها."
    : isLogin
      ? "سجّل دخولك للوصول إلى السجل الرسمي والمسابقات وإدارة البيانات."
      : "املأ بيانات المستخدم الجديد، ثم سجّل الدخول بعد إنشاء الحساب.";

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
              نظام إدارة قسم القرآن الكريم
            </div>
            <h2 className="mt-5 text-3xl font-black leading-relaxed text-white">
              دخول آمن، صلاحيات واضحة، وبيانات محفوظة لكل مستخدم.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-7 text-white/75">
              يدعم النظام إنشاء حسابات مستقلة، إدارة المستخدمين، مشاركة الاطلاع للقراءة فقط، ومزامنة
              السجل مع السحابة عند توفر الاتصال.
            </p>
          </div>

          <div className="relative z-10 grid gap-3">
            {[
              "بيانات كل حساب معزولة ومحمية",
              "تذكّر آخر بريد لتسجيل دخول أسرع",
              "إدارة مستخدمين وصلاحيات للمسؤول",
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
              <h1 className="text-xl font-black text-primary">
                مركز إنماء الأهلي الخيري - قسم القرآن الكريم
              </h1>
              <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isRecovery &&
              (showRemembered ? (
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
              ))}

            <div className="relative">
              {isRecovery ? (
                <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              ) : (
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={isRecovery ? "كلمة المرور الجديدة" : "كلمة المرور"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl pl-10 pr-10"
                required
                minLength={6}
                dir="ltr"
                autoComplete={isLogin ? "current-password" : "new-password"}
                autoFocus={showRemembered || isRecovery}
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

            {isRecovery && (
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="تأكيد كلمة المرور الجديدة"
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

            {!isRecovery && isLogin && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => void handleResetPassword()}
                  disabled={resetLoading}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetLoading ? "جارٍ الإرسال..." : "نسيت كلمة المرور؟"}
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-2xl shadow-lg shadow-primary/20"
              disabled={loading}
            >
              {isRecovery ? (
                <KeyRound className="h-4 w-4" />
              ) : isLogin ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {loading
                ? "جارٍ المعالجة..."
                : isRecovery
                  ? "حفظ كلمة المرور الجديدة"
                  : isLogin
                    ? "تسجيل الدخول"
                    : "إنشاء حساب"}
            </Button>
          </form>

          {!isRecovery && (
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
            للمسؤول إدارة الصلاحيات من صفحة المستخدمين دون الحاجة لمعرفة كلمات مرور الحسابات.
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
