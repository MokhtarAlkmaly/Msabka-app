/**
 * لوحة «الدخول بدون إنترنت» في شاشة الدخول.
 *
 * تظهر عندما:
 *  - انقطع الاتصال، أو
 *  - توجد هوية حساب محفوظة على الجهاز (حتى لو كان الاتصال متاحاً، لأنها
 *    الطريقة الأسرع للدخول في الميدان).
 *
 * تتيح طريقين:
 *  1. **الدخول بالهوية المحفوظة** (+ رمز PIN محلي إن ضبطه المستخدم): تُفتح
 *     الجلسة المحلية وتُنسب كل الإدخالات لنفس حساب السحابة، فيصبح الترحيل
 *     اللاحق بلا أي تحويل.
 *  2. **وضع الجهاز**: عمل محلي كامل بلا حساب — مناسب لأول تشغيل في مكان لا
 *     إنترنت فيه إطلاقاً، ويُربط بالحساب لاحقاً من صفحة الإعدادات.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getOfflineIdentity } from "@/utils/localAuth";
import type { OfflineIdentity } from "@/lib/offline-auth";
import { CloudUpload, KeyRound, Smartphone, WifiOff } from "lucide-react";

const getSafeNext = () => {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("next");
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
};

const OfflineAccessPanel = () => {
  const { signInOffline, signInDeviceMode, pinRequired } = useAuth();
  const { toast } = useToast();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [identity, setIdentity] = useState<OfflineIdentity | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState<"offline" | "device" | null>(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    void getOfflineIdentity()
      .then(setIdentity)
      .catch(() => setIdentity(null));
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // لا معنى للوحة إذا كان الاتصال متاحاً ولا توجد هوية محفوظة على الجهاز.
  if (online && !identity) return null;

  const go = () => window.location.replace(getSafeNext() || "/");

  const enterOffline = async () => {
    setBusy("offline");
    const result = await signInOffline(pin).catch(() => ({
      ok: false,
      error: "تعذّر فتح الجلسة المحلية.",
    }));
    setBusy(null);
    if (!result.ok) {
      toast({
        title: "تعذّر الدخول بدون نت",
        description: result.error ?? "حدث خطأ غير متوقع",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "أنت الآن في وضع العمل بدون نت",
      description: "كل ما تُدخله يُحفظ على الجهاز ويُرحَّل إلى السحابة عند توفر الاتصال.",
    });
    go();
  };

  const enterDeviceMode = async () => {
    setBusy("device");
    const result = await signInDeviceMode().catch(() => ({
      ok: false,
      error: "تعذّر فتح وضع الجهاز.",
    }));
    setBusy(null);
    if (!result.ok) {
      toast({
        title: "تعذّر الدخول",
        description: result.error ?? "حدث خطأ غير متوقع",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "تم الدخول في وضع الجهاز",
      description:
        "اربط هذا الجهاز بحسابك من الإعدادات ← «المزامنة والنسخ الاحتياطي» ليُرحَّل كل ما فيه.",
    });
    go();
  };

  return (
    <div className="mt-5 space-y-3 rounded-[1.5rem] border border-amber-300/50 bg-amber-50/70 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-xl bg-amber-200/70 p-2 text-amber-800">
          {online ? <Smartphone className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </span>
        <div className="text-xs leading-6 text-amber-900">
          <strong className="block text-sm font-bold">العمل بدون إنترنت</strong>
          {!online && <span className="block">لا يوجد اتصال الآن — يمكنك المتابعة من جهازك.</span>}
          {identity ? (
            <span className="block">
              حساب محفوظ على هذا الجهاز:{" "}
              <span className="font-semibold" dir="ltr">
                {identity.email || identity.name || identity.user_id}
              </span>
            </span>
          ) : (
            <span className="block">
              لم يُحفظ حساب على هذا الجهاز بعد — يمكنك البدء في «وضع الجهاز» ثم ربطه بحسابك لاحقاً.
            </span>
          )}
        </div>
      </div>

      {identity && pinRequired && (
        <div className="relative">
          <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-700" />
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="رمز الدخول المحلي (4-8 أرقام)"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
            className="h-11 rounded-2xl border-amber-300/70 bg-white/80 pr-10"
            dir="ltr"
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {identity && (
          <Button
            type="button"
            onClick={() => void enterOffline()}
            disabled={busy !== null}
            className="h-11 flex-1 gap-2 rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/20 hover:bg-amber-700"
          >
            <WifiOff className="h-4 w-4" />
            {busy === "offline" ? "جارٍ الفتح..." : "الدخول بدون نت"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => void enterDeviceMode()}
          disabled={busy !== null}
          className="h-11 flex-1 gap-2 rounded-2xl border-amber-400/60 bg-white/70 text-amber-900 hover:bg-amber-100/70"
        >
          <Smartphone className="h-4 w-4" />
          {busy === "device" ? "جارٍ الفتح..." : "المتابعة بدون حساب (وضع الجهاز)"}
        </Button>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-5 text-amber-800/90">
        <CloudUpload className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          كل الإدخالات تُحفظ في قاعدة بيانات محلية على الجهاز، ويمكن ترحيلها إلى السحابة دفعة واحدة
          من الإعدادات عند توفر الإنترنت.
        </span>
      </p>
    </div>
  );
};

export default OfflineAccessPanel;
