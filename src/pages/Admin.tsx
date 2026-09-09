import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PLANS } from "../config/product";
import { GAMES } from "../data/games";
import { supabase } from "../lib/supabaseClient";
import type { ProfileRow } from "../lib/profile";
import { emptyEntitlement } from "../lib/storage";
import { useApp } from "../state/AppState";
import { Button, Field, Notice, TextArea, TextInput } from "../components/ui";
import type { Game, PlanId } from "../types";

type AdminMember = Pick<ProfileRow, "id" | "email" | "display_name" | "role" | "created_at" | "onboarding_complete">;

function Guard({ children }: { children: ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login?return=/admin" replace />;
  if (user.role !== "admin") {
    return (
      <div className="section wrap">
        <h1 className="display">Access denied</h1>
        <p>Operations tools are limited to authorized studio roles.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function AdminHome() {
  return (
    <Guard>
      <AdminHomeInner />
    </Guard>
  );
}

function AdminHomeInner() {
  const { store, games } = useApp();
  const failed = store.orders.filter((order) => order.status === "declined" || order.status === "expired").length;
  return (
    <div className="section wrap">
      <h1 className="display">Operations</h1>
      <p className="meta">Metrics: all recorded prototype data, not a live time range unless labeled.</p>
      <div className="metric-row">
        <article className="panel">
          <h3>Active members</h3>
          <p>{Object.values(store.entitlementByUser).filter((item) => item.planId && (item.status === "active" || item.status === "active_until")).length}</p>
        </article>
        <article className="panel">
          <h3>Failed payments</h3>
          <p>{failed}</p>
        </article>
        <article className="panel">
          <h3>Published games</h3>
          <p>{games.filter((game) => game.published).length}</p>
        </article>
        <article className="panel">
          <h3>Tickets</h3>
          <p>{store.tickets.length}</p>
        </article>
      </div>
      <div className="actions">
        <Link className="btn btn-primary" to="/admin/members">
          View members
        </Link>
        <Link className="btn btn-secondary" to="/admin/games">
          Manage games
        </Link>
      </div>
    </div>
  );
}

export function AdminMembers() {
  return (
    <Guard>
      <MembersInner />
    </Guard>
  );
}

function MembersInner() {
  const { store } = useApp();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminMember[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("id, email, display_name, role, created_at, onboarding_complete")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadError(error.message);
        else setRows((data ?? []) as AdminMember[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = rows.filter((user) => {
    const haystack = `${user.email ?? ""} ${user.display_name} ${user.id}`.toLowerCase();
    return haystack.includes(q.toLowerCase());
  });

  return (
    <div className="section wrap">
      <h1 className="display">Members</h1>
      {loadError ? <Notice>{loadError}</Notice> : null}
      <Field label="Search email or member ID">
        <TextInput value={q} onChange={(event) => setQ(event.target.value)} />
      </Field>
      <p className="meta">{filtered.length} results</p>
      <table className="table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Access end</th>
            <th>Joined</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => {
            const ent = store.entitlementByUser[user.id] ?? emptyEntitlement();
            return (
              <tr key={user.id}>
                <td>{user.email ?? user.display_name}</td>
                <td>{ent.planId ?? "—"}</td>
                <td>{ent.status}</td>
                <td>{ent.accessEndDate?.slice(0, 10) ?? "—"}</td>
                <td>{user.created_at.slice(0, 10)}</td>
                <td>
                  <Link to={`/admin/members/${user.id}`}>View</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminMemberDetail() {
  return (
    <Guard>
      <MemberDetailInner />
    </Guard>
  );
}

function MemberDetailInner() {
  const { id = "" } = useParams();
  const { store, adminGrant, adminRevoke } = useApp();
  const [user, setUser] = useState<AdminMember | null>(null);
  const [missing, setMissing] = useState(false);
  const [plan, setPlan] = useState<PlanId>("wave");
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("id, email, display_name, role, created_at, onboarding_complete")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setMissing(true);
        else setUser(data as AdminMember);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) return <p>Missing member.</p>;
  if (!user) return <p>Loading member…</p>;
  const ent = store.entitlementByUser[user.id] ?? emptyEntitlement();
  return (
    <div className="section wrap">
      <Link to="/admin/members">Back</Link>
      <h1 className="display">{user.email ?? user.display_name}</h1>
      <p>Role {user.role}. Joined {user.created_at.slice(0, 10)}.</p>
      <div className="panel">
        <h3>Entitlement</h3>
        <p>
          {ent.planId ?? "none"} · {ent.status} · source {ent.source}
        </p>
        <p>Access end {ent.accessEndDate ?? "—"}</p>
      </div>
      <h2>Support tools</h2>
      <Notice>Manual grants are not payments and must not create paid invoices.</Notice>
      <Field label="Grant plan">
        <select value={plan} onChange={(event) => setPlan(event.target.value as PlanId)}>
          {PLANS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Grant expiry (days)">
        <TextInput type="number" value={days} onChange={(event) => setDays(Number(event.target.value))} />
      </Field>
      <Field label="Reason (required)">
        <TextArea value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <p className="meta">
        Result: {plan} access for {days} days from today, if saved.
      </p>
      <div className="actions">
        <Button variant="primary" onClick={() => adminGrant(user.id, plan, days, reason)}>
          Grant plan
        </Button>
        <Button onClick={() => adminRevoke(user.id, reason)}>Revoke plan</Button>
      </div>
    </div>
  );
}

export function AdminGames() {
  return (
    <Guard>
      <GamesInner />
    </Guard>
  );
}

function GamesInner() {
  const { games } = useApp();
  return (
    <div className="section wrap">
      <h1 className="display">Games</h1>
      <Link className="btn btn-primary" to="/admin/games/new">
        Create game
      </Link>
      {games.map((game) => (
        <article key={game.id} className="panel" style={{ marginTop: 12 }}>
          <h3>{game.title}</h3>
          <p className="meta">
            {game.slug} · {game.published ? "Published" : "Draft"} · rotation eligible {String(game.rotationEligible)}
          </p>
          <Link to={`/admin/games/${game.id}`}>Edit</Link> · <Link to={`/games/${game.slug}`}>Preview</Link>
        </article>
      ))}
    </div>
  );
}

export function AdminGameEdit() {
  return (
    <Guard>
      <GameEditInner />
    </Guard>
  );
}

function GameEditInner() {
  const { id = "new" } = useParams();
  const navigate = useNavigate();
  const { games, adminSaveGame, toast } = useApp();
  const existing = games.find((game) => game.id === id);
  const [game, setGame] = useState<Game>(
    existing ?? {
      ...GAMES[0],
      id: crypto.randomUUID(),
      slug: "",
      title: "",
      published: false,
    },
  );
  const save = (publish: boolean) => {
    const result = adminSaveGame({ ...game, published: publish || game.published });
    if (!result.ok) return toast(result.error, "err");
    toast(publish ? "Published." : "Draft saved.", "ok");
    navigate("/admin/games");
  };
  return (
    <div className="section wrap article">
      <h1 className="display">{existing ? "Edit game" : "Create game"}</h1>
      <p>Every published game is free to play. Rotation eligibility controls featured quick picks only.</p>
      <Field label="Title">
        <TextInput value={game.title} onChange={(event) => setGame({ ...game, title: event.target.value })} />
      </Field>
      <Field label="Slug">
        <TextInput value={game.slug} onChange={(event) => setGame({ ...game, slug: event.target.value })} />
      </Field>
      <Field label="Description">
        <TextArea value={game.description} onChange={(event) => setGame({ ...game, description: event.target.value })} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={game.rotationEligible} onChange={(event) => setGame({ ...game, rotationEligible: event.target.checked })} />
        Eligible for featured quick picks
      </label>
      <div className="actions">
        <Button onClick={() => save(false)}>Save draft</Button>
        <Button variant="primary" onClick={() => save(true)}>
          Publish
        </Button>
        <Link to={`/games/${game.slug || "kite-line"}`}>Preview</Link>
      </div>
    </div>
  );
}

export function AdminContent() {
  return (
    <Guard>
      <ContentInner />
    </Guard>
  );
}

function ContentInner() {
  const { store, adminSaveContent } = useApp();
  const [open, setOpen] = useState(store.contentNotes[0]);
  if (!open) return null;
  return (
    <div className="section wrap">
      <h1 className="display">Content</h1>
      <Notice>Editing here does not make policy copy legally approved.</Notice>
      {store.contentNotes.map((note) => (
        <button key={note.id} className="panel" style={{ display: "block", width: "100%", marginBottom: 8, textAlign: "left" }} onClick={() => setOpen(note)}>
          {note.title} · {note.type} · {note.status} · {note.updated}
        </button>
      ))}
      <Field label="Title">
        <TextInput value={open.title} onChange={(event) => setOpen({ ...open, title: event.target.value })} />
      </Field>
      <Field label="Body">
        <TextArea value={open.body} onChange={(event) => setOpen({ ...open, body: event.target.value })} />
      </Field>
      <Button
        variant="primary"
        onClick={() =>
          adminSaveContent({ ...open, status: "published", updated: new Date().toISOString().slice(0, 10) })
        }
      >
        Publish
      </Button>
    </div>
  );
}
