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
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sharedWithMe, setSharedWithMe] = useState<SharedOwner[]>([]);
  const [viewAs, setViewAsState] = useState<ViewAsTarget | null>(null);

  // مزامنة حالة العرض مع المخزن المشترك الذي تقرأه طبقة التخزين.
  useEffect(() => {
    setViewAsState(getViewAs());
    return subscribeViewAs((target) => setViewAsState(target));
  }, []);

  const setViewAs = useCallback((target: ViewAsTarget | null) => {
    persistViewAs(target);
  }, []);

  const loadAccess = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
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

  useEffect(() => {
    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      void loadAccess(nextSession?.user ?? null);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // الخروج من وضع الاطلاع عند تسجيل الخروج أو تبديل الحساب.
      if (event === "SIGNED_OUT") persistViewAs(null);
      applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, [loadAccess]);

  const refreshAccess = useCallback(async () => {
    await loadAccess(user);
  }, [loadAccess, user]);

  const signOut = async () => {
    persistViewAs(null);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setSharedWithMe([]);
  };

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
