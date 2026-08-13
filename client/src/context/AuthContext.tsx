import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest } from "../lib/api";
import { parseAuthUser, type AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<AuthUser | null>;
  acceptSession: (value: unknown) => AuthUser | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const acceptSession = useCallback((value: unknown): AuthUser | null => {
    const parsedUser = parseAuthUser(value);
    setUser(parsedUser);
    return parsedUser;
  }, []);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await apiRequest<unknown>("/auth/me");
      return acceptSession(response);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 401 || error.status === 403) {
        setUser(null);
        return null;
      }

      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [acceptSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await apiRequest<unknown>("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, refresh, acceptSession, signOut }),
    [acceptSession, isLoading, refresh, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
