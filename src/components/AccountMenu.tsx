import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  IconCreditCard,
  IconHelp,
  IconLogout,
  IconSettings,
  IconTool,
  IconUser,
} from "@tabler/icons-react";
import { isMember, membershipChip } from "../lib/access";
import { api } from "../lib/api";
import { useApp } from "../state/AppState";
import { PlayerAvatar } from "./PlayerAvatar";
import type { Entitlement, PlanId, UserProfile } from "../types";

const ITEMS: { to: string; label: string; icon: typeof IconUser; admin?: boolean }[] = [
  { to: "/profile", label: "Profile", icon: IconUser },
  { to: "/billing", label: "Billing", icon: IconCreditCard },
  { to: "/settings", label: "Settings", icon: IconSettings },
  { to: "/help", label: "Help", icon: IconHelp },
  { to: "/admin", label: "Operations", icon: IconTool, admin: true },
];

function tierClass(planId: PlanId | null, member: boolean) {
  if (!member || !planId) return "account-tier account-tier-free";
  if (planId === "tide") return "account-tier account-tier-tide";
  if (planId === "surge") return "account-tier account-tier-surge";
  return "account-tier account-tier-wave";
}

export function AccountMenu({ user }: { user: UserProfile }) {
  const { entitlement: localEntitlement, logout, profileCard } = useApp();
  const [entitlement, setEntitlement] = useState(localEntitlement);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const member = isMember(entitlement);
  const tier = membershipChip(entitlement);

  useEffect(() => {
    setEntitlement(localEntitlement);
  }, [localEntitlement]);

  useEffect(() => {
    void api<{ entitlement: Entitlement }>("/api/me")
      .then((result) => setEntitlement(result.entitlement))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = () => {
    logout();
    setOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <PlayerAvatar name={user.displayName} avatarId={user.avatarId} photoUrl={profileCard.avatarDataUrl} size={40} />
      </button>
      {open ? (
        <div className="account-dropdown" role="menu" aria-label="Account">
          <div className="account-dropdown-head">
            <PlayerAvatar name={user.displayName} avatarId={user.avatarId} photoUrl={profileCard.avatarDataUrl} size={44} />
            <div className="account-dropdown-meta">
              <p className="account-dropdown-name">{user.displayName}</p>
              <p className="account-dropdown-email">{user.email}</p>
            </div>
            <span className={tierClass(entitlement.planId, member)}>{tier}</span>
          </div>
          <div className="account-dropdown-list">
            {ITEMS.filter((item) => !item.admin || user.role === "admin").map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  className={({ isActive }) => `account-dropdown-item${isActive ? " is-active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} stroke={1.7} aria-hidden="true" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
          <div className="account-dropdown-foot">
            <button type="button" className="account-dropdown-item account-dropdown-logout" role="menuitem" onClick={signOut}>
              <IconLogout size={18} stroke={1.7} aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
