"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";
import Header from "./Header";

export default function ConditionalHeader() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();

  // Hide header on home page when not logged in (fullscreen HomePage)
  if (pathname === "/" && !isLoggedIn) {
    return null;
  }

  return <Header />;
}
