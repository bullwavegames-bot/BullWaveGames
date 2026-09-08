import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { formatInr, planById, PRODUCT } from "../config/product";
import { HELP_ARTICLES } from "../data/content";
import { isMember } from "../lib/access";
import { formatKolkata } from "../lib/time";
import { useApp } from "../state/AppState";
import { Button, ButtonLink, Dialog, EmptyState, Field, Notice, TextInput } from "../components/ui";

export function BillingPage() {
  const { user, entitlement, invoices, cancelRenewal, updateBillingEmail } = useApp();
  const [email, setEmail] = useState(user?.billingEmail ?? "");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState("");
  if (!user) return <Navigate to="/login?return=/billing" replace />;
  const member = isMember(entitlement);
  return (
    <div className="section wrap">
      <h1 className="display">Billing</h1>
      <div className="panel">
        <p>Current plan: {entitlement.planId ? planById(entitlement.planId).name : "None"}</p>
        <p>Status: {entitlement.status}</p>
        <p>Access ends: {entitlement.accessEndDate ? formatKolkata(new Date(entitlement.accessEndDate), { dateStyle: "medium" }) : "—"}</p>
        <p>Next payment: {entitlement.nextPaymentDate && PRODUCT.prototype.autoRenewalEnabled ? entitlement.nextPaymentDate : "Not applicable"}</p>
        {member && PRODUCT.prototype.autoRenewalEnabled ? (
          <Button onClick={() => setCancelOpen(true)}>Manage membership</Button>
        ) : member ? (
          <Notice>This membership period expires automatically. There is no renewal to cancel.</Notice>
        ) : (
          <ButtonLink to="/membership" variant="primary">
            See memberships
          </ButtonLink>
        )}
        {message ? <p>{message}</p> : null}
      </div>
      <h2>Invoices</h2>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet." />
      ) : (
        invoices.map((invoice) => (
          <article key={invoice.id} className="panel" style={{ marginBottom: 12 }}>
            <p>{formatKolkata(new Date(invoice.date), { dateStyle: "medium" })}</p>
            <p>
              {planById(invoice.planId).name} · {formatInr(invoice.amountInr)} · {invoice.status}
            </p>
            <Button
              onClick={() => {
                const blob = new Blob(
                  [`Bullwave Games prototype receipt\n${invoice.id}\n${invoice.amountInr} INR\nNot a live payment.`],
                  { type: "text/plain" },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${invoice.id}.txt`;
                a.click();
              }}
            >
              Download PDF
            </Button>
          </article>
        ))
      )}
      <h2>Billing email</h2>
      <Field label="Billing email" hint="This does not change your login email.">
        <TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Button onClick={() => updateBillingEmail(email)}>Save billing email</Button>
      {cancelOpen ? (
        <Dialog title="End renewal?" onClose={() => setCancelOpen(false)}>
          <p>Plan {entitlement.planId ? planById(entitlement.planId).name : ""}.</p>
          <p>Access remains until {entitlement.accessEndDate ? formatKolkata(new Date(entitlement.accessEndDate), { dateStyle: "medium" }) : "the end date"}.</p>
          <p>After that date, member catalog access ends. Cancellation has no extra fee.</p>
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                const result = cancelRenewal();
                setCancelOpen(false);
                setMessage(result.ok ? `Active until ${result.until}` : result.error);
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
  const [authOk, setAuthOk] = useState(false);
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
      <h2>Account</h2>
      <p>Login email {user.email}</p>
      <Field label="Current password">
        <TextInput type="password" value={current} onChange={(event) => setCurrent(event.target.value)} />
      </Field>
      <Field label="New password">
        <TextInput type="password" value={next} onChange={(event) => setNext(event.target.value)} />
      </Field>
      <Button
        onClick={() => {
          const result = changePassword(current, next);
          setPwMsg(result.ok ? "Password saved." : result.error);
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
          <p>Account {user.email}. Saved progress and collection on this prototype will be removed.</p>
          <p>Deletion does not issue a refund. Recurring billing is not enabled in this configuration.</p>
          <p>{PRODUCT.prototype.deletionImmediate ? "Deletion is immediate in this prototype." : "Deletion would be scheduled."}</p>
          {!authOk ? (
            <>
              <Field label="Re-enter password">
                <TextInput type="password" value={current} onChange={(event) => setCurrent(event.target.value)} />
              </Field>
              <Button onClick={() => setAuthOk(current === user.password)}>Confirm it’s you</Button>
            </>
          ) : (
            <div className="actions">
              <Button
                variant="danger"
                onClick={() => {
                  deleteAccount();
                }}
              >
                Delete account
              </Button>
              <Button onClick={() => setDeleteOpen(false)}>Keep account</Button>
            </div>
          )}
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
