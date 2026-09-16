import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Mail, Lock, LogIn, UserPlus, User, X } from "lucide-react";

/** مفتاح حفظ آخر بريد استُخدم لتسجيل الدخول على هذا الجهاز. */
const LAST_EMAIL_KEY = "msabka.lastEmail";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  /** البريد محفوظ من مرة سابقة: نعرضه ثابتاً ونطلب كلمة المرور فقط. */
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const { toast } = useToast();

  // استرجاع آخر بريد استُخدم على هذا الجهاز.
  useEffect(() => {
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

  const nextParam = (() => {
    const p = new URLSearchParams(window.location.search).get("next");
    return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
  })();
  const emailRedirect = nextParam
    ? `${window.location.origin}/auth?next=${encodeURIComponent(nextParam)}`
    : window.location.origin;

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // نحفظ البريد بعد نجاح الدخول فقط.
        try {
          window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
        } catch {
          /* تجاهل */
        }
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك!" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: emailRedirect,
            data: { display_name: displayName.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        try {
          window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
        } catch {
          /* تجاهل */
        }
        toast({
          title: "تم إنشاء الحساب",
          description: "تم إنشاء حسابك بنجاح، يمكنك الآن تسجيل الدخول",
        });
        setIsLogin(true);
      }
    } catch (error: unknown) {
      const message =
        typeof (error as { message?: unknown })?.message === "string"
          ? (error as { message: string }).message
          : "";
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

  // نعرض البريد ثابتاً فقط في وضع تسجيل الدخول وعند وجود بريد محفوظ.
  const showRemembered = isLogin && !!rememberedEmail;

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.55))] flex items-center justify-center p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-md rounded-[2rem] border-white/70 bg-card/90 p-8 shadow-2xl shadow-primary/10 backdrop-blur space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-3xl bg-primary/5 p-3 ring-1 ring-primary/10">
            <img src={logo} alt="الشعار" className="h-20 w-auto" />
          </div>
          <h1 className="text-xl font-black text-primary text-center">
            مركز إنماء الأهلي الخيري - قسم القرآن الكريم
          </h1>
          <p className="text-muted-foreground text-xs text-center">
            {isLogin
              ? "سجّل دخولك للوصول إلى السجل الرسمي والمسابقات"
              : "أنشئ حساباً جديداً — بياناتك خاصة بك وحدك"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-2xl pr-10"
                  required
                  dir="ltr"
                />
              </div>
            </>
          )}

          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-2xl pr-10"
              required
              minLength={6}
              dir="ltr"
              autoFocus={showRemembered}
            />
          </div>

          <Button
            type="submit"
            className="h-12 w-full gap-2 rounded-2xl shadow-lg shadow-primary/20"
            disabled={loading}
          >
            {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {loading ? "جارٍ المعالجة..." : isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
          </Button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setPassword("");
            }}
            className="rounded-full px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
          >
            {isLogin ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل دخولك"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
