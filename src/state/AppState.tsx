import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PRODUCT, planById } from "../config/product";
import { COSMETICS } from "../data/content";
import { GAMES } from "../data/games";
import { emptyEntitlement, loadStore, saveStore, type PersistedStore } from "../lib/storage";
import { isMember } from "../lib/access";
import type {
  Entitlement,
  Game,
  GameSave,
  Invoice,
  PaymentOrder,
  PaymentStatus,
  PersonalBest,
  PlanId,
  UserProfile,
} from "../types";

const AVATARS = ["kite", "lantern", "tide", "gharial", "rangoli", "fold"];

type Settings = PersistedStore["settingsByUser"][string];

const defaultSettings = (): Settings => ({
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  uiSound: false,
  gameSound: false,
  reminderEnabled: false,
  reminderInterval: "tomorrow",
  soundConsent: false,
});

interface AppContextValue {
  store: PersistedStore;
  user: UserProfile | null;
  entitlement: Entitlement;
  settings: Settings;
  games: Game[];
  introDone: boolean;
  toasts: { id: string; text: string; tone: "ok" | "err" | "info" }[];
  age: PersistedStore["age"];
  guestKey: string;
  selectedPlan: PlanId | null;
  avatars: string[];
  identityKey: string;
  setIntroDone: () => void;
  setAge: (age: PersistedStore["age"]) => void;
  toast: (text: string, tone?: "ok" | "err" | "info") => void;
  dismissToast: (id: string) => void;
  setSelectedPlan: (plan: PlanId | null) => void;
  register: (input: { email: string; password: string; returnTo?: string }) => { ok: true } | { ok: false; error: string };
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  requestReset: (email: string) => void;
  resetPassword: (token: string, password: string) => { ok: true } | { ok: false; error: string };
  verifyEmail: () => void;
  resendVerify: () => { ok: true; cooldown: number } | { ok: false };
  changeEmail: (email: string) => void;
  completeOnboarding: (name: string, avatarId: string) => void;
  updateProfile: (name: string, avatarId: string) => { ok: true } | { ok: false; error: string };
  patchSettings: (patch: Partial<Settings>) => void;
  recordResult: (result: { slug: string; score: number; stars: number; metric?: string; save?: GameSave }) => void;
  equip: (id: string) => { ok: true } | { ok: false; error: string };
  createOrder: (planId: PlanId) => { ok: true; order: PaymentOrder } | { ok: false; error: string };
  resolveOrder: (orderId: string, status: PaymentStatus, reason?: string) => PaymentOrder | null;
  checkOrder: (orderId: string) => PaymentOrder | null;
  cancelRenewal: () => { ok: true; until: string } | { ok: false; error: string };
  updateBillingEmail: (email: string) => void;
  sendTicket: (ticket: { name: string; email: string; topic: string; message: string; paymentRef?: string }) => string;
  setBreakReminder: (hours: number, label: string) => { ok: true } | { ok: false; error: string };
  clearBreakReminder: () => void;
  changePassword: (current: string, next: string) => { ok: true } | { ok: false; error: string };
  deleteAccount: () => { ok: true } | { ok: false; error: string };
  enterChallenge: () => void;
  submitChallenge: (score: number) => void;
  adminGrant: (userId: string, planId: PlanId, days: number, reason: string) => { ok: true } | { ok: false; error: string };
  adminRevoke: (userId: string, reason: string) => { ok: true } | { ok: false; error: string };
  adminSaveGame: (game: Game) => { ok: true } | { ok: false; error: string };
  adminSaveContent: (note: PersistedStore["contentNotes"][number]) => void;
  bestFor: (slug: string) => PersonalBest | undefined;
  saveFor: (slug: string) => GameSave | undefined;
  owned: string[];
  invoices: Invoice[];
  pendingResetEmail: string | null;
  verifyCooldown: number;
  lastOrderId: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

function seedAdmin(store: PersistedStore): PersistedStore {
  if (store.users.some((user) => user.email === PRODUCT.prototype.adminEmail)) return store;
  const admin: UserProfile = {
    id: "user-admin-prototype",
    email: PRODUCT.prototype.adminEmail,
    billingEmail: PRODUCT.prototype.adminEmail,
    password: PRODUCT.prototype.adminPassword,
    displayName: "Studio ops",
    avatarId: "lantern",
    emailVerified: true,
    role: "admin",
    createdAt: "2026-09-08T07:36:18Z",
    onboardingComplete: true,
  };
  return { ...store, users: [...store.users, admin] };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<PersistedStore>(() => seedAdmin(loadStore()));
  const [introDone, setIntro] = useState(() => sessionStorage.getItem("bw.intro") === "1");
  const [toasts, setToasts] = useState<AppContextValue["toasts"]>([]);
  const [pendingResetEmail, setPendingResetEmail] = useState<string | null>(null);
  const [verifyCooldown, setVerifyCooldown] = useState(0);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = window.setTimeout(() => setVerifyCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [verifyCooldown]);

  const patch = useCallback((updater: (current: PersistedStore) => PersistedStore) => {
    setStore((current) => updater(current));
  }, []);

  const toast = useCallback((text: string, tone: "ok" | "err" | "info" = "info") => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, text, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const user = store.users.find((item) => item.id === store.sessionUserId) ?? null;
  const identityKey = user?.id ?? `guest:${store.guestKey}`;
  const entitlement = store.entitlementByUser[identityKey] ?? emptyEntitlement();
  const settings = store.settingsByUser[identityKey] ?? defaultSettings();
  const games = store.gamesOverride.length ? [...GAMES.map(game => store.gamesOverride.find(item => item.slug === game.slug) ?? game), ...store.gamesOverride.filter(item => !GAMES.some(game => game.slug === item.slug))] : GAMES;

  const value: AppContextValue = useMemo(() => {
    return {
      store,
      user,
      entitlement,
      settings,
      games,
      introDone,
      toasts,
      age: store.age,
      guestKey: store.guestKey,
      selectedPlan: store.selectedPlan,
      avatars: AVATARS,
      identityKey,
      setIntroDone: () => {
        sessionStorage.setItem("bw.intro", "1");
        setIntro(true);
      },
      setAge: (age) => patch((current) => ({ ...current, age })),
      toast,
      dismissToast: (id) => setToasts((current) => current.filter((item) => item.id !== id)),
      setSelectedPlan: (plan) => patch((current) => ({ ...current, selectedPlan: plan })),
      register: ({ email, password }) => {
        const normalized = email.trim().toLowerCase();
        if (store.users.some((item) => item.email === normalized)) {
          return { ok: false, error: "An account with this email already exists. Log in instead." };
        }
        const profile: UserProfile = {
          id: crypto.randomUUID(),
          email: normalized,
          billingEmail: normalized,
          password,
          displayName: normalized.split("@")[0] ?? "Player",
          avatarId: "lantern",
          emailVerified: false,
          role: normalized === PRODUCT.prototype.adminEmail ? "admin" : "player",
          createdAt: new Date().toISOString(),
          onboardingComplete: false,
        };
        patch((current) => ({
          ...current,
          users: [...current.users, profile],
          sessionUserId: profile.id,
          ownedCosmetics: {
            ...current.ownedCosmetics,
            [profile.id]: ["frame-standard"],
          },
        }));
        return { ok: true };
      },
      login: (email, password) => {
        const found = store.users.find(
          (item) => item.email === email.trim().toLowerCase() && item.password === password,
        );
        if (!found) return { ok: false, error: "Email or password is incorrect." };
        patch((current) => ({ ...current, sessionUserId: found.id }));
        return { ok: true };
      },
      logout: () => patch((current) => ({ ...current, sessionUserId: null })),
      requestReset: (email) => setPendingResetEmail(email.trim().toLowerCase()),
      resetPassword: (_token, password) => {
        if (!pendingResetEmail) return { ok: false, error: "This reset link is invalid or has expired." };
        const found = store.users.find((item) => item.email === pendingResetEmail);
        if (!found) return { ok: false, error: "This reset link is invalid or has expired." };
        patch((current) => ({
          ...current,
          users: current.users.map((item) => (item.email === pendingResetEmail ? { ...item, password } : item)),
        }));
        return { ok: true };
      },
      verifyEmail: () => {
        if (!user) return;
        patch((current) => ({
          ...current,
          users: current.users.map((item) => (item.id === user.id ? { ...item, emailVerified: true } : item)),
        }));
      },
      resendVerify: () => {
        if (verifyCooldown > 0) return { ok: false };
        setVerifyCooldown(30);
        return { ok: true, cooldown: 30 };
      },
      changeEmail: (email) => {
        if (!user) return;
        patch((current) => ({
          ...current,
          users: current.users.map((item) =>
            item.id === user.id ? { ...item, email: email.toLowerCase(), emailVerified: false } : item,
          ),
        }));
      },
      completeOnboarding: (name, avatarId) => {
        if (!user) return;
        patch((current) => ({
          ...current,
          users: current.users.map((item) =>
            item.id === user.id
              ? { ...item, displayName: name || item.displayName, avatarId, onboardingComplete: true }
              : item,
          ),
        }));
      },
      updateProfile: (name, avatarId) => {
        if (!user) return { ok: false, error: "Sign in to edit your profile." };
        if (name.trim().length < 2) return { ok: false, error: "Use at least two characters." };
        patch((current) => ({
          ...current,
          users: current.users.map((item) =>
            item.id === user.id ? { ...item, displayName: name.trim(), avatarId } : item,
          ),
        }));
        toast("Profile saved.", "ok");
        return { ok: true };
      },
      patchSettings: (next) => {
        patch((current) => ({
          ...current,
          settingsByUser: {
            ...current.settingsByUser,
            [identityKey]: { ...settings, ...next },
          },
        }));
      },
      recordResult: ({ slug, score, stars, metric, save }) => {
        const bestKey = `${identityKey}:${slug}`;
        const previous = store.bests[bestKey];
        const nextBest =
          !previous || score > previous.score
            ? { slug, score, stars, metric, at: new Date().toISOString() }
            : previous;
        const achievementId =
          slug === "kite-line"
            ? "trophy-first-flight"
            : slug === "lantern-path"
              ? "trophy-garden"
              : slug === "tide-tap" && score >= 8
                ? "trophy-horizon"
                : null;
        patch((current) => {
          const owned = new Set(current.ownedCosmetics[identityKey] ?? ["frame-standard"]);
          if (isMember(entitlement)) owned.add("frame-standard");
          if (entitlement.planId === "tide") {
            owned.add("theme-tide");
            owned.add("theme-paper");
            owned.add("badge-tide");
          }
          if (entitlement.planId === "surge" || entitlement.planId === "tide") owned.add("badge-challenge");
          if (achievementId) owned.add(achievementId);
          const list = current.achievements[identityKey] ?? [];
          const achievements =
            achievementId && !list.some((item) => item.id === achievementId)
              ? [...list, { id: achievementId, title: COSMETICS.find((item) => item.id === achievementId)?.name ?? achievementId, earnedAt: new Date().toISOString() }]
              : list;
          return {
            ...current,
            bests: { ...current.bests, [bestKey]: nextBest },
            saves: save ? { ...current.saves, [bestKey]: save } : current.saves,
            ownedCosmetics: { ...current.ownedCosmetics, [identityKey]: [...owned] },
            achievements: { ...current.achievements, [identityKey]: achievements },
          };
        });
      },
      equip: (id) => {
        const item = COSMETICS.find((cosmetic) => cosmetic.id === id);
        const owned = store.ownedCosmetics[identityKey] ?? [];
        if (!item || !owned.includes(id)) return { ok: false, error: "This item is not available to equip." };
        patch((current) => {
          const equipped = current.equipped[identityKey] ?? { frameId: null, themeId: null, badgeId: null };
          const next = { ...equipped };
          if (item.kind === "frame") next.frameId = id;
          if (item.kind === "theme") next.themeId = id;
          if (item.kind === "badge") next.badgeId = id;
          return { ...current, equipped: { ...current.equipped, [identityKey]: next } };
        });
        toast("Equipped.", "ok");
        return { ok: true };
      },
      createOrder: (planId) => {
        if (!user) return { ok: false, error: "Sign in to continue to payment." };
        if (isMember(entitlement) && entitlement.planId === planId) {
          return { ok: false, error: "This plan is already active." };
        }
        const order: PaymentOrder = {
          id: crypto.randomUUID(),
          planId,
          amountInr: planById(planId).monthlyPriceInr,
          status: "creating",
          createdAt: new Date().toISOString(),
          userId: user.id,
          activated: false,
          reference: `BW-${Date.now().toString(36).toUpperCase()}`,
        };
        setLastOrderId(order.id);
        patch((current) => ({ ...current, orders: [...current.orders, order] }));
        return { ok: true, order };
      },
      resolveOrder: (orderId, status, reason) => {
        let updated: PaymentOrder | null = null;
        patch((current) => {
          const orders = current.orders.map((order) => {
            if (order.id !== orderId) return order;
            updated = { ...order, status, safeReason: reason };
            return updated;
          });
          if (!updated) return current;
          const order = updated;
          if (status !== "succeeded") {
            return {
              ...current,
              orders,
              entitlementByUser: {
                ...current.entitlementByUser,
                [order.userId]: {
                  ...(current.entitlementByUser[order.userId] ?? emptyEntitlement()),
                  status: status === "uncertain" || status === "pending" ? "pending" : current.entitlementByUser[order.userId]?.status ?? "none",
                },
              },
            };
          }
          if (order.activated) return { ...current, orders };
          const accessEnd = new Date();
          accessEnd.setUTCDate(accessEnd.getUTCDate() + PRODUCT.prototype.accessPeriodDays);
          const invoice: Invoice = {
            id: `inv-${order.id}`,
            date: new Date().toISOString(),
            planId: order.planId,
            amountInr: order.amountInr,
            status: "paid",
            orderId: order.id,
          };
          const already = current.invoices.some((item) => item.orderId === order.id);
          return {
            ...current,
            orders: orders.map((item) => (item.id === order.id ? { ...item, activated: true, status: "succeeded" } : item)),
            invoices: already ? current.invoices : [...current.invoices, invoice],
            entitlementByUser: {
              ...current.entitlementByUser,
              [order.userId]: {
                planId: order.planId,
                status: PRODUCT.prototype.autoRenewalEnabled ? "active" : "active_until",
                accessEndDate: accessEnd.toISOString(),
                nextPaymentDate: PRODUCT.prototype.autoRenewalEnabled ? PRODUCT.prototype.sampleBillingDate : null,
                cancelAtPeriodEnd: false,
                source: "payment",
                orderId: order.id,
              },
            },
            ownedCosmetics: {
              ...current.ownedCosmetics,
              [order.userId]: Array.from(
                new Set([
                  ...(current.ownedCosmetics[order.userId] ?? []),
                  "frame-standard",
                  ...(order.planId === "surge" || order.planId === "tide" ? ["badge-challenge"] : []),
                  ...(order.planId === "tide" ? ["theme-tide", "theme-paper", "badge-tide"] : []),
                ]),
              ),
            },
          };
        });
        return updated;
      },
      checkOrder: (orderId) => store.orders.find((order) => order.id === orderId) ?? null,
      cancelRenewal: () => {
        if (!PRODUCT.prototype.autoRenewalEnabled) {
          return { ok: false, error: "This membership period does not renew automatically. Access ends on the date shown." };
        }
        if (!isMember(entitlement) || !entitlement.accessEndDate) {
          return { ok: false, error: "There is no renewing membership to cancel." };
        }
        patch((current) => ({
          ...current,
          entitlementByUser: {
            ...current.entitlementByUser,
            [identityKey]: { ...entitlement, status: "active_until", cancelAtPeriodEnd: true },
          },
        }));
        return { ok: true, until: entitlement.accessEndDate };
      },
      updateBillingEmail: (email) => {
        if (!user) return;
        patch((current) => ({
          ...current,
          users: current.users.map((item) => (item.id === user.id ? { ...item, billingEmail: email.toLowerCase() } : item)),
        }));
        toast("Billing email updated. Login email is unchanged.", "ok");
      },
      sendTicket: (ticket) => {
        const id = `T-${Date.now().toString(36).toUpperCase()}`;
        patch((current) => ({
          ...current,
          tickets: [...current.tickets, { ...ticket, id, at: new Date().toISOString() }],
        }));
        return id;
      },
      setBreakReminder: (hours, label) => {
        try {
          localStorage.setItem("bw.reminder-test", "1");
          patch((current) => ({
            ...current,
            breakReminder: { until: Date.now() + hours * 3600000, label },
            settingsByUser: {
              ...current.settingsByUser,
              [identityKey]: { ...settings, reminderEnabled: true },
            },
          }));
          return { ok: true };
        } catch {
          return { ok: false, error: "This browser blocked the local reminder." };
        }
      },
      clearBreakReminder: () =>
        patch((current) => ({
          ...current,
          breakReminder: null,
          settingsByUser: {
            ...current.settingsByUser,
            [identityKey]: { ...settings, reminderEnabled: false },
          },
        })),
      changePassword: (currentPassword, next) => {
        if (!user || user.password !== currentPassword) return { ok: false, error: "Current password is incorrect." };
        patch((current) => ({
          ...current,
          users: current.users.map((item) => (item.id === user.id ? { ...item, password: next } : item)),
        }));
        return { ok: true };
      },
      deleteAccount: () => {
        if (!user) return { ok: false, error: "Sign in first." };
        patch((current) => ({
          ...current,
          users: current.users.filter((item) => item.id !== user.id),
          sessionUserId: null,
        }));
        return { ok: true };
      },
      enterChallenge: () =>
        patch((current) => ({
          ...current,
          challengeEntered: { ...current.challengeEntered, [identityKey]: true },
        })),
      submitChallenge: (score) =>
        patch((current) => ({
          ...current,
          challengeScores: {
            ...current.challengeScores,
            [identityKey]: Math.max(score, current.challengeScores[identityKey] ?? 0),
          },
        })),
      adminGrant: (userId, planId, days, reason) => {
        if (!reason.trim()) return { ok: false, error: "A reason is required for the audit log." };
        const accessEnd = new Date();
        accessEnd.setUTCDate(accessEnd.getUTCDate() + days);
        patch((current) => ({
          ...current,
          entitlementByUser: {
            ...current.entitlementByUser,
            [userId]: {
              planId,
              status: "active_until",
              accessEndDate: accessEnd.toISOString(),
              nextPaymentDate: null,
              cancelAtPeriodEnd: false,
              source: "admin-grant",
              orderId: null,
            },
          },
        }));
        toast("Grant saved. This is not a payment and no invoice was created.", "ok");
        return { ok: true };
      },
      adminRevoke: (userId, reason) => {
        if (!reason.trim()) return { ok: false, error: "A reason is required for the audit log." };
        patch((current) => ({
          ...current,
          entitlementByUser: {
            ...current.entitlementByUser,
            [userId]: { ...emptyEntitlement(), status: "expired" },
          },
        }));
        toast("Access revoked.", "ok");
        return { ok: true };
      },
      adminSaveGame: (game) => {
        if (!game.title.trim() || !game.slug.trim()) return { ok: false, error: "Title and slug are required." };
        const exists = games.some((item) => item.slug === game.slug && item.id !== game.id);
        if (exists) return { ok: false, error: "That slug is already in use." };
        patch((current) => {
          const base = current.gamesOverride.length ? current.gamesOverride : GAMES;
          const next = base.some((item) => item.id === game.id)
            ? base.map((item) => (item.id === game.id ? game : item))
            : [...base, game];
          return { ...current, gamesOverride: next };
        });
        return { ok: true };
      },
      adminSaveContent: (note) =>
        patch((current) => ({
          ...current,
          contentNotes: current.contentNotes.some((item) => item.id === note.id)
            ? current.contentNotes.map((item) => (item.id === note.id ? note : item))
            : [...current.contentNotes, note],
        })),
      bestFor: (slug) => store.bests[`${identityKey}:${slug}`],
      saveFor: (slug) => store.saves[`${identityKey}:${slug}`],
      owned: store.ownedCosmetics[identityKey] ?? [],
      invoices: store.invoices.filter((invoice) => invoice.orderId && store.orders.find((order) => order.id === invoice.orderId && order.userId === user?.id)),
      pendingResetEmail,
      verifyCooldown,
      lastOrderId,
    };
  }, [
    store,
    user,
    entitlement,
    settings,
    games,
    introDone,
    toasts,
    identityKey,
    patch,
    toast,
    pendingResetEmail,
    verifyCooldown,
    lastOrderId,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppStateProvider");
  return value;
}
