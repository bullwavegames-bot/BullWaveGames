import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { formatInr, planById, PRODUCT } from "../config/product";
import { HELP_ARTICLES } from "../data/content";
import { continueCap, isMember, membershipChip } from "../lib/access";
import { api } from "../lib/api";
import { formatKolkata } from "../lib/time";
import { useApp } from "../state/AppState";
import { PageIntro } from "../components/PageIntro";
import { Button, ButtonLink, Dialog, EmptyState, Field, Notice, TextInput } from "../components/ui";
import type { Entitlement, Invoice } from "../types";

function statusLabel(status: Entitlement["status"]): string {
  if (status === "active") return "Active";
  if (status === "active_until") return "Active this period";
  if (status === "pending") return "Payment pending";
  if (status === "past_due") return "Past due";
  if (status === "expired") return "Ended";
  return "Free play";
}

function sourceLabel(source: Entitlement["source"]): string {
  if (source === "admin-grant") return "Studio grant";
  if (source === "payment") return "Paid checkout";
  return "No membership charge";
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

function downloadReceipt(invoice: Invoice) {
  const plan = planById(invoice.planId);
  const paidOn = formatKolkata(new Date(invoice.date), { dateStyle: "medium" });
  const body = [
    PRODUCT.brand,
    PRODUCT.legalEntity,
    `Receipt ${invoice.id}`,
    `Date ${paidOn} IST`,
    `Plan ${plan.name}`,
    `Amount ${formatInr(invoice.amountInr)} ${PRODUCT.currency}`,
    `Status ${invoice.status}`,
    `Order ${invoice.orderId}`,
    PRODUCT.prototype.taxIncludedInDisplayedPrice ? "Displayed price includes applicable tax." : "",
    `Checkout ${PRODUCT.prototype.paymentProviderName}`,
  ]
    .filter(Boolean)
    .join("\n");
  const blob = new Blob([body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.id}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function BillingPage() {
  const { user, updateBillingEmail } = useApp();
  const [email, setEmail] = useState(user?.billingEmail ?? "");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement>({
    planId: null,
    status: "none",
    accessEndDate: null,
    nextPaymentDate: null,
    cancelAtPeriodEnd: false,
    source: "none",
    orderId: null,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (user?.billingEmail) setEmail(user.billingEmail);
  }, [user?.billingEmail]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      api<{ entitlement: Entitlement }>("/api/me"),
      api<{ invoices: Invoice[] }>("/api/billing/invoices"),
    ])
      .then(([me, list]) => {
        setEntitlement(me.entitlement);
        setInvoices(list.invoices);
      })
      .catch((cause: Error) => setLoadError(cause.message));
  }, [user]);

  if (!user) return <Navigate to="/login?return=/billing" replace />;

  const member = isMember(entitlement);
  const plan = entitlement.planId ? planById(entitlement.planId) : null;
  const remaining = daysLeft(entitlement.accessEndDate);
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
  const spent = paidInvoices.reduce((sum, invoice) => sum + invoice.amountInr, 0);
  const continues = continueCap(entitlement);
  const accessEnd = entitlement.accessEndDate
    ? formatKolkata(new Date(entitlement.accessEndDate), { dateStyle: "medium" })
    : null;
  const nextPay =
    entitlement.nextPaymentDate && PRODUCT.prototype.autoRenewalEnabled
      ? formatKolkata(new Date(entitlement.nextPaymentDate), { dateStyle: "medium" })
      : null;

  const saveEmail = () => {
    setSaving(true);
    setMessage("");
    void api("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ billingEmail: email }),
    })
      .then(() => {
        updateBillingEmail(email);
        setMessage("Billing email saved. Login email is unchanged.");
      })
      .catch((cause: Error) => setMessage(cause.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="section wrap billing-page">
      <PageIntro
        eyebrow="Account"
        title="Billing."
        description="Your membership period, receipts, and billing email. Eight games stay free even after a plan ends."
      />

      {loadError ? <Notice>{loadError}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      <section className={`billing-hero billing-hero-${plan?.id ?? "free"}`}>
        <div>
          <p className="kicker">{member ? "Current membership" : "Play without a plan"}</p>
          <h2>{plan ? plan.name : "Free play"}</h2>
          <p className="billing-hero-lede">
            {member
              ? `${plan?.benefits[0] ?? "Studio access"}. ${PRODUCT.prototype.autoRenewalEnabled ? "Renewal follows the payment provider." : "This period does not auto-renew."}`
              : "Eight always-free games plus five plays on other titles. Unlock the catalog when you want it."}
          </p>
          <div className="billing-hero-actions">
            {member && PRODUCT.prototype.autoRenewalEnabled ? (
              <Button onClick={() => setCancelOpen(true)}>Manage renewal</Button>
            ) : null}
            <ButtonLink to="/membership" variant={member ? "secondary" : "primary"}>
              {member ? "Change plan" : "See memberships"}
            </ButtonLink>
          </div>
        </div>
        <dl className="billing-facts">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`billing-pill billing-pill-${entitlement.status}`}>{statusLabel(entitlement.status)}</span>
            </dd>
          </div>
          <div>
            <dt>Access ends</dt>
            <dd>{accessEnd ?? "No end date"}</dd>
          </div>
          <div>
            <dt>Days left</dt>
            <dd>{remaining == null ? "—" : remaining === 0 ? "Last day" : `${remaining} day${remaining === 1 ? "" : "s"}`}</dd>
          </div>
          <div>
            <dt>Next payment</dt>
            <dd>{nextPay ?? "None — no auto-renew"}</dd>
          </div>
        </dl>
      </section>

      <div className="billing-stats">
        <article className="panel">
          <h3>Period</h3>
          <p>{PRODUCT.prototype.accessPeriodDays} days</p>
          <small>Membership length after a successful checkout.</small>
        </article>
        <article className="panel">
          <h3>Continues</h3>
          <p>{member ? continues : "Free play"}</p>
          <small>{member ? `${plan?.name} continue cap for this period.` : "Join a plan for extra continues."}</small>
        </article>
        <article className="panel">
          <h3>Receipts</h3>
          <p>{paidInvoices.length}</p>
          <small>{paidInvoices.length ? `${formatInr(spent)} paid so far.` : "No paid invoices yet."}</small>
        </article>
        <article className="panel">
          <h3>Source</h3>
          <p>{sourceLabel(entitlement.source)}</p>
          <small>{PRODUCT.prototype.paymentProviderName}</small>
        </article>
      </div>

      <div className="billing-grid">
        <section className="panel billing-card">
          <h2>Included in {plan ? plan.name : "free play"}</h2>
          <ul className="billing-perks">
            {(plan?.benefits ?? [
              `${PRODUCT.prototype.freeDailyGameCount} always-free games`,
              `${PRODUCT.prototype.freePlaysPerGame} free plays on other titles`,
              "No wallet and no stakes",
            ]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {member ? (
            <p className="meta">When this period ends, always-free games stay open. Other catalog titles return to five free plays each.</p>
          ) : (
            <p className="meta">
              Wave {formatInr(399)}, Surge {formatInr(799)}, and Tide {formatInr(1499)} unlock unlimited catalog play.
            </p>
          )}
        </section>

        <section className="panel billing-card">
          <h2>How billing works</h2>
          <dl className="billing-meta">
            <div>
              <dt>Merchant</dt>
              <dd>{PRODUCT.legalEntity}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>
                {PRODUCT.currency} · India
              </dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{PRODUCT.prototype.taxIncludedInDisplayedPrice ? "Included in the displayed price" : "Shown at checkout"}</dd>
            </div>
            <div>
              <dt>Renewal</dt>
              <dd>{PRODUCT.prototype.autoRenewalEnabled ? "On, until you cancel" : "Off — access ends on the date above"}</dd>
            </div>
            <div>
              <dt>Login email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Order</dt>
              <dd>{entitlement.orderId ?? "No checkout on file"}</dd>
            </div>
          </dl>
          <p className="meta">
            <Link to="/refund-and-cancellation-policy">Refund policy</Link>
            {" · "}
            <Link to="/terms-and-conditions">Terms</Link>
            {" · "}
            <Link to="/help/finding-invoices">Invoice help</Link>
          </p>
        </section>
      </div>

      <section>
        <div className="section-head">
          <h2>Receipts</h2>
          <p className="meta">Paid memberships list here with date, plan, amount, and status.</p>
        </div>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet." action={<ButtonLink to="/membership">See memberships</ButtonLink>} />
        ) : (
          <div className="billing-invoices">
            {invoices.map((invoice) => (
              <article key={invoice.id} className="panel billing-invoice">
                <div>
                  <p className="kicker">{formatKolkata(new Date(invoice.date), { dateStyle: "medium" })}</p>
                  <h3>
                    {planById(invoice.planId).name} · {formatInr(invoice.amountInr)}
                  </h3>
                  <p className="meta">Receipt {invoice.id}</p>
                </div>
                <div className="billing-invoice-end">
                  <span className={`billing-pill billing-pill-${invoice.status}`}>{invoice.status}</span>
                  <Button onClick={() => downloadReceipt(invoice)}>Download receipt</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel billing-card">
        <h2>Billing email</h2>
        <p className="meta">Receipts and payment notices use this address. It does not change your login email.</p>
        <Field label="Billing email" hint={`Login stays ${user.email}.`}>
          <TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Button variant="primary" disabled={saving} onClick={saveEmail}>
          {saving ? "Saving…" : "Save billing email"}
        </Button>
      </section>

      {cancelOpen ? (
        <Dialog title="End renewal?" onClose={() => setCancelOpen(false)}>
          <p>Plan {plan?.name ?? ""}.</p>
          <p>Access remains until {accessEnd ?? "the end date"}.</p>
          <p>After that date, member perks end. Every published always-free game remains playable. Cancellation has no extra fee.</p>
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                void api<{ entitlement: Entitlement }>("/api/billing/cancel", { method: "POST" })
                  .then((result) => {
                    setEntitlement(result.entitlement);
                    setCancelOpen(false);
                    setMessage(result.entitlement.accessEndDate ? `Active until ${result.entitlement.accessEndDate}` : "Cancelled.");
                  })
                  .catch((cause: Error) => {
                    setCancelOpen(false);
                    setMessage(cause.message);
                  });
              }}
            >
              Confirm cancellation
            </Button>
            <Button onClick={() => setCancelOpen(false)}>Keep membership</Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

const REMINDER_OPTIONS = [
  { id: "tonight" as const, hours: 4, label: "In 4 hours", hint: "A short pause later today." },
  { id: "tomorrow" as const, hours: 24, label: "Tomorrow", hint: "Remind you in 24 hours." },
  { id: "weekend" as const, hours: 48, label: "In two days", hint: "A longer break. Still local to this browser." },
];

function SettingToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function SettingsPage() {
  const {
    user,
    settings,
    patchSettings,
    setBreakReminder,
    clearBreakReminder,
    changePassword,
    deleteAccount,
    logout,
    store,
    entitlement,
  } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [breakOpen, setBreakOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reminderChoice, setReminderChoice] = useState<(typeof REMINDER_OPTIONS)[number]["id"]>(settings.reminderInterval);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  if (!user) return <Navigate to="/login?return=/settings" replace />;

  const reminder = store.breakReminder;
  const reminderLive = Boolean(reminder && reminder.until > Date.now());
  const reminderUntil = reminderLive && reminder
    ? formatKolkata(new Date(reminder.until), { dateStyle: "medium", timeStyle: "short" })
    : null;
  const soundOn = settings.uiSound || settings.gameSound;
  const member = isMember(entitlement);

  const savePassword = () => {
    setPwMsg("");
    setPwError("");
    if (next.length < 8) {
      setPwError("Use at least 8 characters for the new password.");
      return;
    }
    if (next !== confirm) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    void changePassword(current, next).then((result) => {
      if (result.ok) {
        setPwMsg("Password saved.");
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setPwError(result.error);
      }
    });
  };

  return (
    <div className="section wrap settings-page">
      <PageIntro
        eyebrow="Account"
        title="Settings."
        description="Display, sound, reminders, and account controls for this browser. These preferences stay on this device."
      >
        <nav className="settings-jump" aria-label="Settings sections">
          <a href="#display">Display</a>
          <a href="#audio">Audio</a>
          <a href="#reminders">Reminders</a>
          <a href="#language">Language</a>
          <a href="#privacy">Privacy</a>
          <a href="#account">Account</a>
        </nav>
      </PageIntro>

      <div className="billing-stats">
        <article className="panel">
          <h3>Motion</h3>
          <p>{settings.reducedMotion ? "Reduced" : "Full"}</p>
          <small>{settings.reducedMotion ? "Animations stay minimal" : "Studio motion is on"}</small>
        </article>
        <article className="panel">
          <h3>Sound</h3>
          <p>{soundOn ? "On" : "Muted"}</p>
          <small>{settings.soundConsent ? "You enabled sound on this device" : "Muted by default for new users"}</small>
        </article>
        <article className="panel">
          <h3>Reminder</h3>
          <p>{reminderLive ? "Active" : "Off"}</p>
          <small>{reminderUntil ? `Until ${reminderUntil} IST` : "Never closes a game"}</small>
        </article>
        <article className="panel">
          <h3>Account</h3>
          <p>{membershipChip(entitlement)}</p>
          <small>{user.email}</small>
        </article>
      </div>

      <section id="display" className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Comfort</p>
            <h2>Display</h2>
          </div>
        </div>
        <SettingToggle
          label="Reduced motion"
          hint="Skip decorative motion on the studio shell, welcome, and game cards. Games still play."
          checked={settings.reducedMotion}
          onChange={(value) => patchSettings({ reducedMotion: value })}
        />
      </section>

      <section id="audio" className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Optional</p>
            <h2>Audio</h2>
          </div>
          <p className="meta">Muted by default. Studio stings play only after you turn sound on.</p>
        </div>
        <SettingToggle
          label="UI sound"
          hint="Short interface cues in menus. Never required to play."
          checked={settings.uiSound}
          onChange={(value) => patchSettings({ uiSound: value, soundConsent: true })}
        />
        <SettingToggle
          label="Game sound"
          hint="In-session audio. You can still mute from a game’s own controls."
          checked={settings.gameSound}
          onChange={(value) => patchSettings({ gameSound: value, soundConsent: true })}
        />
        {soundOn ? (
          <div className="challenge-hero-actions">
            <Button
              onClick={() => patchSettings({ uiSound: false, gameSound: false, soundConsent: true })}
            >
              Mute all
            </Button>
          </div>
        ) : null}
      </section>

      <section id="reminders" className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Play reminders</p>
            <h2>Take a break</h2>
          </div>
          <p className="meta">Local to this browser. Reminders never lock the account or close a game.</p>
        </div>
        {reminderLive ? (
          <p className="challenge-standing">
            Reminder is on until {reminderUntil} IST{reminder?.label ? ` · ${reminder.label}` : ""}.
          </p>
        ) : (
          <p className="meta">No reminder is set. Choose a pause if you want a nudge to step away.</p>
        )}
        <div className="challenge-hero-actions">
          <Button variant="primary" onClick={() => setBreakOpen(true)}>
            {reminderLive ? "Change reminder" : "Set a reminder"}
          </Button>
          {settings.reminderEnabled || reminderLive ? (
            <Button onClick={clearBreakReminder}>Remove reminder</Button>
          ) : null}
        </div>
      </section>

      <section id="language" className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Locale</p>
            <h2>Language and region</h2>
          </div>
        </div>
        <dl className="billing-meta">
          <div>
            <dt>Language</dt>
            <dd>English</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>India-first</dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{PRODUCT.timezone} · daily reset {PRODUCT.prototype.dailyResetHourLabel} IST</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{PRODUCT.currency} · membership from ₹399</dd>
          </div>
        </dl>
        <p className="meta">Additional languages are not available in this release.</p>
      </section>

      <section id="privacy" className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Data on this device</p>
            <h2>Privacy</h2>
          </div>
        </div>
        <ul className="challenge-rules">
          <li>
            <strong>Profile card stays local</strong>
            <span>Display name, @handle, bio, and avatar photos are stored in this browser until Friends launches. Photos are not uploaded yet.</span>
          </li>
          <li>
            <strong>Play history is on-device</strong>
            <span>Personal bests, reminders, and sound preferences use local storage. They are not a public follower graph.</span>
          </li>
          <li>
            <strong>Membership is a flat subscription</strong>
            <span>No wallet, no deposits-to-win. Billing email can differ from login email.</span>
          </li>
        </ul>
        <div className="challenge-hero-actions">
          <ButtonLink to="/privacy-policy">Privacy policy</ButtonLink>
          <ButtonLink to="/profile">Edit profile</ButtonLink>
        </div>
      </section>

      <section id="account" className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Login</p>
            <h2>Account</h2>
          </div>
          <span className={`billing-pill ${user.emailVerified ? "billing-pill-paid" : "billing-pill-pending"}`}>
            {user.emailVerified ? "Email verified" : "Verify email"}
          </span>
        </div>
        <dl className="billing-meta">
          <div>
            <dt>Login email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Display name</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatKolkata(new Date(user.createdAt), { dateStyle: "medium" })} IST</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{member ? membershipChip(entitlement) : "Free play"}</dd>
          </div>
        </dl>
        <div className="challenge-hero-actions">
          <ButtonLink to="/billing">Billing</ButtonLink>
          <ButtonLink to="/profile">Profile</ButtonLink>
          <ButtonLink to="/help">Help</ButtonLink>
          <Button onClick={() => logout()}>Log out</Button>
        </div>

        <h3 className="settings-subhead">Change password</h3>
        <p className="meta">Use a new password of at least 8 characters. This updates your Bullwave login.</p>
        <div className="settings-password">
          <Field label="Current password">
            <TextInput type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
          </Field>
          <Field label="New password">
            <TextInput type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
        </div>
        <div className="challenge-hero-actions">
          <Button variant="primary" onClick={savePassword}>
            Save password
          </Button>
        </div>
        {pwMsg ? <Notice>{pwMsg}</Notice> : null}
        {pwError ? <p className="error">{pwError}</p> : null}

        <h3 className="settings-subhead">Delete account</h3>
        <p className="meta">
          This signs you out of this browser. Deletion does not issue a refund. Recurring billing is not enabled in this configuration.
        </p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          Delete account
        </Button>
      </section>

      {breakOpen ? (
        <Dialog title="Take a break" onClose={() => setBreakOpen(false)}>
          <p>Set a local reminder to return later. This is not an account lock and it will not close a game.</p>
          <div className="settings-reminder-choices">
            {REMINDER_OPTIONS.map((option) => (
              <label key={option.id} className={`settings-choice ${reminderChoice === option.id ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="reminder"
                  checked={reminderChoice === option.id}
                  onChange={() => setReminderChoice(option.id)}
                />
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </label>
            ))}
          </div>
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                const option = REMINDER_OPTIONS.find((item) => item.id === reminderChoice) ?? REMINDER_OPTIONS[0];
                patchSettings({ reminderInterval: option.id });
                const result = setBreakReminder(option.hours, option.label);
                setBreakOpen(false);
                setPwMsg("");
                setPwError(result.ok ? "" : result.error);
                if (result.ok) setPwMsg("Reminder saved on this browser.");
              }}
            >
              Save reminder
            </Button>
            <Button onClick={() => setBreakOpen(false)}>Cancel</Button>
          </div>
        </Dialog>
      ) : null}
      {deleteOpen ? (
        <Dialog title="Delete this account?" onClose={() => setDeleteOpen(false)}>
          <p>Account {user.email}. This signs you out of this browser. Full removal from Supabase Auth still needs the studio API.</p>
          <p>Deletion does not issue a refund. Recurring billing is not enabled in this configuration.</p>
          <Field label="Re-enter password">
            <TextInput type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
          </Field>
          {pwError ? <p className="error">{pwError}</p> : null}
          <div className="actions">
            <Button
              variant="danger"
              onClick={() => {
                void deleteAccount(deletePassword).then((result) => {
                  if (!result.ok) setPwError(result.error);
                });
              }}
            >
              Sign out and close session
            </Button>
            <Button onClick={() => setDeleteOpen(false)}>Keep account</Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

export function HelpPage() {
  const [q, setQ] = useState("");
  const results = HELP_ARTICLES.filter((item) => `${item.title} ${item.shortAnswer}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="section wrap">
      <h1 className="display">Help</h1>
      <Field label="Search help">
        <TextInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search topics" />
      </Field>
      {results.length === 0 ? (
        <EmptyState title="No matching articles." action={<ButtonLink to="/contact">Contact support</ButtonLink>} />
      ) : (
        <div className="help-grid">
          {results.map((item) => (
            <Link key={item.slug} className="panel" to={`/help/${item.slug}`}>
              <h3>{item.title}</h3>
              <p className="meta">{item.shortAnswer}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function HelpArticlePage() {
  const { slug } = useParams();
  const article = HELP_ARTICLES.find((item) => item.slug === slug);
  if (!article) return <EmptyState title="Missing article" />;
  return (
    <div className="section wrap article">
      <p>
        <Link to="/help">Help</Link> / {article.title}
      </p>
      <h1 className="display">{article.title}</h1>
      <p className="lede">{article.shortAnswer}</p>
      <ol>
        {article.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="actions">
        {article.contextualHref ? (
          <ButtonLink to={article.contextualHref} variant="primary">
            {article.contextualLabel}
          </ButtonLink>
        ) : null}
        <ButtonLink to="/contact">Contact support</ButtonLink>
      </div>
      <h2>Related</h2>
      {article.related.map((item) => (
        <p key={item}>
          <Link to={`/help/${item}`}>{HELP_ARTICLES.find((entry) => entry.slug === item)?.title ?? item}</Link>
        </p>
      ))}
    </div>
  );
}
