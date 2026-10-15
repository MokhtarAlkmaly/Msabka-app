import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { checkIsAdmin, listSharedWithMe, type SharedOwner } from "@/utils/users";
import {
  getViewAs,
  setViewAs as persistViewAs,
  subscribeViewAs,
  type ViewAsTarget,
} from "@/utils/viewAs";
import {
  activateDeviceSession,
  activateOfflineSession,
  clearLocalSession,
  countUnlinkedDeviceRows,
  getLocalSession,
  getOfflineIdentity,
  hasLocalPin,
  linkDeviceToAccount,
  touchLocalSession,
  verifyLocalPin,
} from "@/utils/localAuth";
import { toast } from "@/hooks/use-toast";
import { type LocalSession, type SessionMode } from "@/lib/offline-auth";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** هل الحساب الحالي مسؤول؟ */
  isAdmin: boolean;
  /** الحسابات التي سمحت لي بالاطلاع على بياناتها. */
  sharedWithMe: SharedOwner[];
  /** الحساب الذي أطالع بياناته حالياً (قراءة فقط)، أو null. */
  viewAs: ViewAsTarget | null;
  /** تشغيل/إيقاف وضع الاطلاع. */
  setViewAs: (target: ViewAsTarget | null) => void;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;

  // ===== العمل بدون إنترنت =====
  /** نمط الجلسة الحالية: سحابية / محلية بهوية محفوظة / وضع الجهاز / لا شيء. */
  authMode: SessionMode | "none";
  /** هل الجلسة الحالية محلية (بلا اتصال بالسحابة)؟ */
  isOfflineSession: boolean;
  /** هل توجد هوية حساب محفوظة تتيح الدخول بدون نت؟ */
  hasSavedIdentity: boolean;
  /** هل الدخول بدون نت محمي برمز PIN؟ */
  pinRequired: boolean;
  /** دخول بدون نت بالهوية المحفوظة (بعد تحقّق PIN إن وُجد). */
  signInOffline: (pin?: string) => Promise<{ ok: boolean; error?: string }>;
  /** دخول «وضع الجهاز»: عمل محلي كامل بلا حساب، يُربط بالسحابة لاحقاً. */
  signInDeviceMode: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  sharedWithMe: [],
  viewAs: null,
  setViewAs: () => {},
  refreshAccess: async () => {},
  signOut: async () => {},
  authMode: "none",
  isOfflineSession: false,
  hasSavedIdentity: false,
  pinRequired: false,
  signInOffline: async () => ({ ok: false, error: "غير متاح" }),
  signInDeviceMode: async () => ({ ok: false, error: "غير متاح" }),
});

/**
 * مستخدم اصطناعي لجلسة محلية — يكفي الواجهات التي تقرأ `user.id` والبريد
 * والاسم. لا يُرسل إلى Supabase أبداً (كل استعلام سحابي محمي بفحص الاتصال
 * ونمط الجلسة في طبقة التخزين).
 */
const syntheticUser = (session: LocalSession): User =>
  ({
    id: session.user_id,
    aud: "authenticated",
    role: "authenticated",
    email: session.email ?? undefined,
    phone: "",
    confirmed_at: new Date(session.activated_at).toISOString(),
    app_metadata: { provider: "local", providers: ["local"] },
    user_metadata: {
      full_name: session.name ?? "",
      offline: true,
      mode: session.mode,
    },
    created_at: new Date(session.activated_at).toISOString(),
  }) as unknown as User;

/**
 * ربط تلقائي لبيانات «وضع الجهاز» بأول حساب يسجّل دخوله على هذا الجهاز.
 * يُنفَّذ مرة واحدة لكل عملية إقلاع للتطبيق (حتى لا يتكرر مع كل تجديد رمز).
 */
let autoLinkAttemptedFor: string | null = null;
const autoLinkDeviceData = async (userId: string) => {
  if (autoLinkAttemptedFor === userId) return;
  autoLinkAttemptedFor = userId;
  try {
    const waiting = await countUnlinkedDeviceRows();
    if (waiting === 0) return;
    const { total } = await linkDeviceToAccount(userId);
    if (total > 0) {
      toast({
        title: "تم ربط بيانات الجهاز بحسابك",
        description: `${total} سجل محلي صار منسوباً إليك، وجاهز للترحيل إلى السحابة.`,
      });
    }
  } catch (error) {
    console.warn("تعذّر ربط بيانات الجهاز بالحساب:", error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sharedWithMe, setSharedWithMe] = useState<SharedOwner[]>([]);
  const [viewAs, setViewAsState] = useState<ViewAsTarget | null>(null);
  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
  const [hasSavedIdentity, setHasSavedIdentity] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);

  // مزامنة حالة العرض مع المخزن المشترك الذي تقرأه طبقة التخزين.
  useEffect(() => {
    setViewAsState(getViewAs());
    return subscribeViewAs((target) => setViewAsState(target));
  }, []);

  const setViewAs = useCallback((target: ViewAsTarget | null) => {
    persistViewAs(target);
  }, []);

  const authMode: SessionMode | "none" = session ? "cloud" : (localSession?.mode ?? "none");
  const isOfflineSession = !session && Boolean(localSession);

  const loadAccess = useCallback(async (currentUser: User | null, cloudSession: boolean) => {
    if (!currentUser || !cloudSession) {
      setIsAdmin(false);
      setSharedWithMe([]);
      return;
    }
    const [admin, shared] = await Promise.all([
      checkIsAdmin().catch(() => false),
      listSharedWithMe().catch(() => [] as SharedOwner[]),
    ]);
    setIsAdmin(admin);
    setSharedWithMe(shared);

    // إن سُحب الإذن أثناء الاطلاع، نُخرج المستخدم من وضع العرض فوراً.
    const active = getViewAs();
    if (active && !admin && !shared.some((s) => s.owner_id === active.id)) {
      persistViewAs(null);
    }
  }, []);

  /** يفتح جلسة محلية محفوظة (إن وُجدت) عندما لا تتوفر جلسة سحابية. */
  const applyLocalSession = useCallback(async () => {
    const [stored, identity, hasPin] = await Promise.all([
      getLocalSession().catch(() => null),
      getOfflineIdentity().catch(() => null),
      hasLocalPin().catch(() => false),
    ]);
    setHasSavedIdentity(Boolean(identity));
    setPinRequired(hasPin && !stored);

    if (!stored) {
      setLocalSession(null);
      return null;
    }
    setLocalSession(stored);
    setUser(syntheticUser(stored));
    return stored;
  }, []);

  useEffect(() => {
    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      if (nextSession?.user) {
        // جلسة سحابية حقيقية تلغي أي جلسة محلية.
        setLocalSession(null);
        setUser(nextSession.user);
        setLoading(false);
        void loadAccess(nextSession.user, true);
        void autoLinkDeviceData(nextSession.user.id);
      } else {
        setUser(null);
        void (async () => {
          const local = await applyLocalSession();
          if (local) void loadAccess(syntheticUser(local), false);
          setLoading(false);
        })();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // الخروج من وضع الاطلاع عند تسجيل الخروج أو تبديل الحساب.
      if (event === "SIGNED_OUT") persistViewAs(null);
      applySession(session);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch(() => {
        // فشل قراءة الجلسة (مثلاً بلا نت مع رمز منتهي) → نجرب المحلية.
        applySession(null);
      });

    return () => subscription.unsubscribe();
  }, [applyLocalSession, loadAccess]);

  // إبقاء الجلسة المحلية حيّة أثناء الاستخدام حتى لا تنتهي صلاحيتها.
  useEffect(() => {
    if (!localSession) return;
    void touchLocalSession().catch(() => undefined);
  }, [localSession]);

  const refreshAccess = useCallback(async () => {
    await loadAccess(user, Boolean(session));
  }, [loadAccess, user, session]);

  const signOut = async () => {
    persistViewAs(null);
    await supabase.auth.signOut().catch(() => undefined);
    await clearLocalSession().catch(() => undefined);
    setSession(null);
    setLocalSession(null);
    setUser(null);
    setIsAdmin(false);
    setSharedWithMe([]);
  };

  /**
   * الدخول بدون نت: يتحقق من رمز PIN (إن كان مضبوطاً) ثم يفتح جلسة محلية
   * بهوية الحساب المحفوظة من آخر دخول ناجح.
   */
  const signInOffline = useCallback(
    async (pin?: string): Promise<{ ok: boolean; error?: string }> => {
      const identity = await getOfflineIdentity().catch(() => null);
      if (!identity) {
        return {
          ok: false,
          error: "لا توجد هوية حساب محفوظة على هذا الجهاز — يلزم اتصال مرة واحدة لتسجيل الدخول.",
        };
      }
      const needsPin = await hasLocalPin().catch(() => false);
      if (needsPin) {
        const ok = await verifyLocalPin(pin ?? "").catch(() => false);
        if (!ok) return { ok: false, error: "رمز الدخول المحلي غير صحيح." };
      }
      const activated = await activateOfflineSession(identity);
      if (!activated) return { ok: false, error: "تعذّر فتح الجلسة المحلية." };

      setLocalSession(activated);
      setUser(syntheticUser(activated));
      setSession(null);
      setIsAdmin(false);
      setSharedWithMe([]);
      setLoading(false);
      return { ok: true };
    },
    [],
  );

  /** الدخول في «وضع الجهاز»: بيانات محلية بالكامل بلا حساب، تُربط لاحقاً. */
  const signInDeviceMode = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const activated = await activateDeviceSession();
    setLocalSession(activated);
    setUser(syntheticUser(activated));
    setSession(null);
    setIsAdmin(false);
    setSharedWithMe([]);
    setLoading(false);
    return { ok: true };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isAdmin,
        sharedWithMe,
        viewAs,
        setViewAs,
        refreshAccess,
        signOut,
        authMode,
        isOfflineSession,
        hasSavedIdentity,
        pinRequired,
        signInOffline,
        signInDeviceMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
