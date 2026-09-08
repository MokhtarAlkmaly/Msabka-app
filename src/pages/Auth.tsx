import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Mail, Lock, LogIn, UserPlus } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const nextParam = (() => {
    const p = new URLSearchParams(window.location.search).get("next");
    return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
  })();
  const emailRedirect = nextParam
    ? `${window.location.origin}/auth?next=${encodeURIComponent(nextParam)}`
    : window.location.origin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك!" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: emailRedirect },
        });
        if (error) throw error;
        toast({
          title: "تم إنشاء الحساب",
          description: "تم إنشاء حسابك بنجاح، يمكنك الآن تسجيل الدخول",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message === "Invalid login credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.55))] flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md rounded-[2rem] border-white/70 bg-card/90 p-8 shadow-2xl shadow-primary/10 backdrop-blur space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-3xl bg-primary/5 p-3 ring-1 ring-primary/10">
            <img src={logo} alt="الشعار" className="h-20 w-auto" />
          </div>
          <h1 className="text-2xl font-black text-primary">كشف المسابقة الرمضانية</h1>
          <p className="text-muted-foreground text-sm">
            {isLogin ? "سجّل دخولك للوصول إلى البيانات" : "أنشئ حساباً جديداً"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            />
          </div>

          <Button type="submit" className="h-12 w-full gap-2 rounded-2xl shadow-lg shadow-primary/20" disabled={loading}>
            {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {loading ? "جارٍ المعالجة..." : isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
          </Button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
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
