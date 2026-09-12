import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";
import type { ProfileRow } from "../lib/profile";
import type { UserProfile } from "../types";

const AVATARS = ["kite", "lantern", "tide", "gharial", "rangoli", "fold"] as const;

function mapUser(sessionUser: User, profile: ProfileRow | null): UserProfile {
  return {
    id: sessionUser.id,
    email: sessionUser.email ?? profile?.email ?? "",
    billingEmail: sessionUser.email ?? profile?.email ?? "",
    displayName: profile?.display_name || sessionUser.email?.split("@")[0] || "Player",
    avatarId: profile?.avatar_id || "lantern",
    emailVerified: Boolean(sessionUser.email_confirmed_at),
    role: profile?.role === "admin" ? "admin" : "player",
    createdAt: profile?.created_at ?? sessionUser.created_at,
    onboardingComplete: Boolean(profile?.onboarding_complete),
  };
}

function authMessage(error: { message: string } | null | undefined, fallback: string): string {
  const message = error?.message ?? "";
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed")) return "Confirm your email before logging in. Check your inbox for the link.";
  if (lower.includes("invalid login")) return "Email or password is incorrect.";
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Log in instead.";
  }
  if (lower.includes("password")) return message;
  if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Try again shortly.";
  if (lower.includes("redirect")) return "This reset or verify link is not allowed. Check the Supabase redirect URL list.";
  return message || fallback;
}

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) return data as ProfileRow;
    await new Promise((resolve) => window.setTimeout(resolve, 200));
  }
  return null;
}

type AuthResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  session: Session | null;
  authUser: User | null;
  profile: ProfileRow | null;
  user: UserProfile | null;
  loading: boolean;
  configured: boolean;
  avatars: readonly string[];
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<ProfileRow | null>;
  signUp: (email: string, password: string) => Promise<AuthResult & { needsConfirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  requestReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  changePassword: (current: string, next: string) => Promise<AuthResult>;
  resendVerify: (email: string) => Promise<AuthResult>;
  changeEmail: (email: string) => Promise<AuthResult>;
  completeOnboarding: (name: string, avatarId: string) => Promise<AuthResult>;
  updateProfile: (name: string, avatarId: string) => Promise<AuthResult>;
  deleteAccount: (password: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next?.user) {
      setProfile(null);
      return;
    }
    setProfile(await loadProfile(next.user.id));
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void hydrate(data.session).finally(() => {
        if (active) setLoading(false);
      });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      void hydrate(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [hydrate]);

  const refreshProfile = useCallback(async () => {
    const id = session?.user.id;
    if (!id) return null;
    const row = await loadProfile(id);
    setProfile(row);
    return row;
  }, [session?.user.id]);

  const user = session?.user ? mapUser(session.user, profile) : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authUser: session?.user ?? null,
      profile,
      user,
      loading,
      configured: supabaseConfigured,
      avatars: AVATARS,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshProfile,
      signUp: async (email, password) => {
        if (!supabaseConfigured) return { ok: false, error: "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." };
        const origin = window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: `${origin}/welcome` },
        });
        if (error) return { ok: false, error: authMessage(error, "Could not create the account.") };
        return { ok: true, needsConfirm: !data.session };
      },
      signIn: async (email, password) => {
        if (!supabaseConfigured) return { ok: false, error: "Supabase is not configured." };
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) return { ok: false, error: authMessage(error, "Email or password is incorrect.") };
        return { ok: true };
      },
      requestReset: async (email) => {
        if (!supabaseConfigured) return { ok: false, error: "Supabase is not configured." };
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) return { ok: false, error: authMessage(error, "Could not send a reset email.") };
        return { ok: true };
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { ok: false, error: authMessage(error, "Could not save the new password.") };
        return { ok: true };
      },
      changePassword: async (current, next) => {
        const email = session?.user.email;
        if (!email) return { ok: false, error: "Sign in first." };
        const check = await supabase.auth.signInWithPassword({ email, password: current });
        if (check.error) return { ok: false, error: "Current password is incorrect." };
        const { error } = await supabase.auth.updateUser({ password: next });
        if (error) return { ok: false, error: authMessage(error, "Could not save the new password.") };
        return { ok: true };
      },
      resendVerify: async (email) => {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: `${window.location.origin}/verify-email` },
        });
        if (error) return { ok: false, error: authMessage(error, "Could not resend the email.") };
        return { ok: true };
      },
      changeEmail: async (email) => {
        const { error } = await supabase.auth.updateUser(
          { email: email.trim().toLowerCase() },
          { emailRedirectTo: `${window.location.origin}/verify-email` },
        );
        if (error) return { ok: false, error: authMessage(error, "Could not update email.") };
        return { ok: true };
      },
      completeOnboarding: async (name, avatarId) => {
        const id = session?.user.id;
        if (!id) return { ok: false, error: "Sign in first." };
        if (!AVATARS.includes(avatarId as (typeof AVATARS)[number])) return { ok: false, error: "Unknown avatar." };
        const displayName = name.trim() || "Player";
        if (displayName.length < 2) return { ok: false, error: "Use at least two characters, or leave the default." };
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: displayName, avatar_id: avatarId, onboarding_complete: true })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        await refreshProfile();
        return { ok: true };
      },
      updateProfile: async (name, avatarId) => {
        const id = session?.user.id;
        if (!id) return { ok: false, error: "Sign in to edit your profile." };
        if (name.trim().length < 2) return { ok: false, error: "Use at least two characters." };
        if (!AVATARS.includes(avatarId as (typeof AVATARS)[number])) return { ok: false, error: "Unknown avatar." };
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: name.trim(), avatar_id: avatarId })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        await refreshProfile();
        return { ok: true };
      },
      deleteAccount: async (password) => {
        const email = session?.user.email;
        if (!email) return { ok: false, error: "Sign in first." };
        const check = await supabase.auth.signInWithPassword({ email, password });
        if (check.error) return { ok: false, error: "Password is incorrect." };
        await supabase.auth.signOut();
        return { ok: true };
      },
    }),
    [session, profile, user, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
