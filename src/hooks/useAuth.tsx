import { createContext, useContext } from "react";

// Local-only mode: the app no longer talks to a cloud auth service.
// There is always exactly one local user whose data lives entirely in
// this device's local database (IndexedDB). No login/sign-up is needed.

interface LocalUser {
  id: string;
}

interface AuthContextType {
  session: null;
  user: LocalUser;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const LOCAL_USER_ID = "local-user";

const localUser: LocalUser = { id: LOCAL_USER_ID };

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: localUser,
  loading: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // No async initialization needed: the local user always exists.
  const value: AuthContextType = {
    session: null,
    user: localUser,
    loading: false,
    signOut: async () => {
      // Nothing to sign out of locally. Kept as a no-op so existing UI
      // that calls signOut() keeps working without special-casing it.
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
