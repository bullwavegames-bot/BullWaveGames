import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { formatInr, planById, PRODUCT } from "../config/product";
import { HELP_ARTICLES } from "../data/content";
import { continueCap, isMember } from "../lib/access";
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

export function SettingsPage() {
  const { user, settings, patchSettings, setBreakReminder, clearBreakReminder, changePassword, deleteAccount } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [breakOpen, setBreakOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  if (!user) return <Navigate to="/login?return=/settings" replace />;
  return (
    <div className="section wrap article">
      <h1 className="display">Settings</h1>
      <h2>Display</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(event) => patchSettings({ reducedMotion: event.target.checked })}
        />
        Reduced motion
      </label>
      <h2>Audio</h2>
      <p className="meta">Muted by default for new users. Optional studio sting plays only after you enable sound.</p>
      <label className="check">
        <input type="checkbox" checked={settings.uiSound} onChange={(event) => patchSettings({ uiSound: event.target.checked, soundConsent: true })} />
        UI sound
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.gameSound} onChange={(event) => patchSettings({ gameSound: event.target.checked, soundConsent: true })} />
        Game sound
      </label>
      <h2>Play reminders</h2>
      <p>Reminders never close a game. They are local to this browser.</p>
      <Button onClick={() => setBreakOpen(true)}>Take a break</Button>
      {settings.reminderEnabled ? <Button onClick={clearBreakReminder}>Remove reminder</Button> : null}
      <h2>Language</h2>
      <p>English</p>
      <h2 id="privacy">Privacy</h2>
      <p>Your display name, handle, and bio stay on this device until Friends launches. Avatar photos are stored locally and are not uploaded yet.</p>
      <p>
        <Link to="/privacy-policy">Read the privacy policy</Link>
      </p>
      <h2 id="account">Account</h2>
      <p>Login email {user.email}</p>
      <Field label="Current password">
        <TextInput type="password" value={current} onChange={(event) => setCurrent(event.target.value)} />
      </Field>
      <Field label="New password">
        <TextInput type="password" value={next} onChange={(event) => setNext(event.target.value)} />
      </Field>
      <Button
        onClick={() => {
          void changePassword(current, next).then((result) => {
            setPwMsg(result.ok ? "Password saved." : result.error);
            if (result.ok) {
              setCurrent("");
              setNext("");
            }
          });
        }}
      >
        Save password
      </Button>
      {pwMsg ? <p>{pwMsg}</p> : null}
      <Button variant="danger" onClick={() => setDeleteOpen(true)}>
        Delete account
      </Button>
      {breakOpen ? (
        <Dialog title="Take a break" onClose={() => setBreakOpen(false)}>
          <p>Set a local reminder to return later. This is not an account lock.</p>
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                const result = setBreakReminder(4, "tonight");
                setBreakOpen(false);
                setPwMsg(result.ok ? "Reminder saved on this browser." : result.error);
              }}
            >
              Set reminder
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
            <TextInput type="password" value={current} onChange={(event) => setCurrent(event.target.value)} />
          </Field>
          {pwMsg ? <p className="error">{pwMsg}</p> : null}
          <div className="actions">
            <Button
              variant="danger"
              onClick={() => {
                void deleteAccount(current).then((result) => {
                  if (!result.ok) setPwMsg(result.error);
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
