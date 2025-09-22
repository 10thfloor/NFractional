"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useFlowCurrentUser } from "@onflow/react-sdk";

type AuthContextType = {
  isLoggedIn: boolean;
  authenticate: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  authenticate: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, authenticate } = useFlowCurrentUser();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const prevLoggedInRef = useRef<boolean | undefined>(undefined);

  // Only update state when loggedIn actually changes
  useEffect(() => {
    const currentLoggedIn = Boolean(user?.loggedIn);
    if (prevLoggedInRef.current !== currentLoggedIn) {
      prevLoggedInRef.current = currentLoggedIn;
      setIsLoggedIn(currentLoggedIn);
    }
  }, [user?.loggedIn]);

  // Memoize authenticate to prevent re-renders
  const handleAuthenticate = useCallback(() => {
    authenticate();
  }, [authenticate]);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, authenticate: handleAuthenticate }}
    >
      {children}
    </AuthContext.Provider>
  );
}
