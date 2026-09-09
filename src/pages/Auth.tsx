import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { allowlistReturn, checkoutPath, planFromQuery } from "../lib/access";
import { useApp } from "../state/AppState";
import { useAuth } from "../state/AuthContext";
import { Button, ButtonLink, Field, Notice, TextInput } from "../components/ui";
import { PRODUCT } from "../config/product";

const PASSWORD_HINT = "Use 8+ characters with a letter and a number.";

function validPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export function RegisterPage() {
  const { setSelectedPlan } = useApp();
  const { signUp, user, loading, configured } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const plan = planFromQuery(params.get("plan"));
  const returnTo = allowlistReturn(params.get("return"), plan ? checkoutPath(plan) : "/welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!email.includes("@")) return setError("Enter a valid email.");
    if (!validPassword(password)) return setError(PASSWORD_HINT);
    if (!terms) return setError("Agree to the Terms to continue.");
    setBusy(true);
    const result = await signUp(email, password);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (plan) setSelectedPlan(plan);
    if (result.needsConfirm) navigate("/verify-email");
    else navigate("/welcome?return=" + encodeURIComponent(returnTo));
  };

  if (loading) return <p className="section wrap">Loading…</p>;
  if (user?.emailVerified) return <Navigate to={user.onboardingComplete ? returnTo : "/welcome"} replace />;

  return (
    <div className="auth-layout">
      <div className="auth-art" aria-hidden="true" />
      <div className="auth-form">
        <h1 className="display">Create account</h1>
        <p>Your game or membership choice is kept. Payment is not asked here.</p>
        {configured ? null : (
          <Notice>Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a root .env file.</Notice>
        )}
        {plan ? <Notice>Selected plan: {plan}. You will return to checkout after welcome.</Notice> : null}
        <Field label="Email">
          <TextInput type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password" hint={PASSWORD_HINT}>
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput
              type={show ? "text" : "password"}
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              style={{ flex: 1 }}
            />
            <Button type="button" onClick={() => setShow((value) => !value)}>
              {show ? "Hide" : "Show"}
            </Button>
          </div>
        </Field>
        <label className="check">
          <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
          I agree to the <Link to="/terms-and-conditions">Terms</Link> and have read the <Link to="/privacy-policy">Privacy Policy</Link>.
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <Button variant="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "Creating…" : "Create account"}
          </Button>
          <ButtonLink to={`/login?return=${encodeURIComponent(returnTo)}`}>Log in</ButtonLink>
        </div>
        <p className="meta">Google sign-in is hidden because it is not configured.</p>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { signIn, user, loading, refreshProfile, configured } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = allowlistReturn(params.get("return"), "/play");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    const result = await signIn(email, password);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    const profile = await refreshProfile();
    setBusy(false);
    if (!profile?.onboarding_complete) navigate("/welcome?return=" + encodeURIComponent(returnTo));
    else navigate(returnTo);
  };

  if (loading) return <p className="section wrap">Loading…</p>;
  if (user?.emailVerified && user.onboardingComplete) return <Navigate to={returnTo} replace />;

  return (
    <div className="auth-layout">
      <div className="auth-art" aria-hidden="true" />
      <div className="auth-form">
        <h1 className="display">Log in</h1>
        {configured ? null : (
          <Notice>Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a root .env file.</Notice>
        )}
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password">
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput type={show ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} style={{ flex: 1 }} />
            <Button type="button" onClick={() => setShow((v) => !v)}>
              {show ? "Hide" : "Show"}
            </Button>
          </div>
        </Field>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <Button variant="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "Signing in…" : "Log in"}
          </Button>
          <ButtonLink to="/register">Create account</ButtonLink>
        </div>
        <p>
          <Link to="/forgot-password">Forgot password</Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPage() {
  const { requestReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="section wrap article">
      <h1 className="display">Forgot password</h1>
      <p>Enter your email and we’ll send instructions to reset your password.</p>
      {sent ? (
        <>
          <p>If that email is on file, instructions are on the way. This message is the same either way.</p>
          <ButtonLink to="/login">Back to login</ButtonLink>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void requestReset(email).finally(() => window.setTimeout(() => setBusy(false), 15000));
            }}
          >
            Resend
          </Button>
        </>
      ) : (
        <>
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          {error ? <p className="error">{error}</p> : null}
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              if (!email.includes("@")) return;
              setBusy(true);
              void requestReset(email).then((result) => {
                setBusy(false);
                if (!result.ok) setError(result.error);
                else setSent(true);
              });
            }}
          >
            Send reset link
          </Button>
        </>
      )}
    </div>
  );
}

export function ResetPage() {
  const { updatePassword, session, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const expired = params.get("expired") === "1";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="section wrap">Loading…</p>;

  if (expired) {
    return (
      <div className="section wrap">
        <h1 className="display">This reset link is no longer valid.</h1>
        <ButtonLink to="/forgot-password" variant="primary">
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="section wrap">
        <h1 className="display">Open the link from your email.</h1>
        <p>The reset page needs the signed link Supabase sent. Request a new one if this tab was opened directly.</p>
        <ButtonLink to="/forgot-password" variant="primary">
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="section wrap article">
      <h1 className="display">Choose a new password</h1>
      <Field label="New password" hint={PASSWORD_HINT}>
        <TextInput type={show ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>
      <Field label="Confirm password">
        <TextInput type={show ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </Field>
      <Button type="button" onClick={() => setShow((v) => !v)}>
        {show ? "Hide passwords" : "Show passwords"}
      </Button>
      {error ? <p className="error">{error}</p> : null}
      <Button
        variant="primary"
        disabled={busy}
        onClick={() => {
          if (password !== confirm) return setError("Passwords do not match.");
          if (!validPassword(password)) return setError(PASSWORD_HINT);
          setBusy(true);
          void updatePassword(password).then((result) => {
            setBusy(false);
            if (!result.ok) return setError(result.error);
            navigate("/login");
          });
        }}
      >
        Save new password
      </Button>
    </div>
  );
}

export function VerifyPage() {
  const { user, session, resendVerify, changeEmail } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [verifyCooldown, setVerifyCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = window.setTimeout(() => setVerifyCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [verifyCooldown]);

  const masked = useMemo(() => {
    const value = email || user?.email || "";
    if (!value.includes("@")) return "your email";
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }, [email, user?.email]);

  const confirmed = Boolean(user?.emailVerified);

  return (
    <div className="section wrap article">
      <h1 className="display">{confirmed ? "Email confirmed" : "Verify email"}</h1>
      {confirmed ? (
        <>
          <Notice>Your email is confirmed. Continue to set your name, then play.</Notice>
          <ButtonLink to="/welcome" variant="primary">
            Continue
          </ButtonLink>
        </>
      ) : (
        <>
          <p>We sent a link to {masked}. Open it in this browser. You cannot enter the arcade until the address is confirmed.</p>
          {session ? <p className="meta">Signed in — waiting for confirmation.</p> : <p className="meta">After you click the email link, this page will update.</p>}
        </>
      )}
      {message ? <p>{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="actions">
        <Button
          disabled={verifyCooldown > 0}
          onClick={() => {
            if (!email.includes("@")) return setError("Enter the email you registered with.");
            setError("");
            void resendVerify(email).then((result) => {
              if (!result.ok) setError(result.error);
              else {
                setMessage("If that address is on file, a new link is on the way.");
                setVerifyCooldown(30);
              }
            });
          }}
        >
          {verifyCooldown > 0 ? `Resend in ${verifyCooldown}s` : "Resend"}
        </Button>
      </div>
      <Field label="Change email">
        <TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Button
        onClick={() => {
          setError("");
          void changeEmail(email).then((result) => {
            if (!result.ok) setError(result.error);
            else setMessage("Check the new address for a confirmation link.");
          });
        }}
      >
        Update email
      </Button>
    </div>
  );
}

export function WelcomePage() {
  const { completeOnboarding, avatars, user } = useAuth();
  const { setSelectedPlan } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = allowlistReturn(params.get("return"), "/play");
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.displayName ?? "");
  const [avatar, setAvatar] = useState(user?.avatarId ?? "lantern");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
    if (user?.avatarId) setAvatar(user.avatarId);
  }, [user?.displayName, user?.avatarId]);

  const finish = async () => {
    if (name.trim() && name.trim().length < 2) return setError("Use at least two characters, or leave the default.");
    setBusy(true);
    const result = await completeOnboarding(name.trim() || user?.displayName || "Player", avatar);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const plan = planFromQuery(params.get("plan"));
    if (plan) setSelectedPlan(plan);
    navigate(returnTo);
  };

  return (
    <div className="section wrap">
      <p className="kicker">Step {step} of 3</p>
      {step === 1 ? (
        <>
          <img src="/covers/kite-line-cover.png" alt="Paper kite over a coastal city." style={{ borderRadius: 18, maxHeight: 280, objectFit: "cover", width: "100%" }} />
          <h1 className="display">Welcome to your browser arcade.</h1>
          <p>Short sessions. Instant play. No download.</p>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <h1 className="display">Free stays free.</h1>
          <p>Every published game is free to play. Membership adds optional cosmetics and convenience perks — Wave {PRODUCT.prototype ? "from ₹399 / month" : ""}.</p>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <h1 className="display">Make it yours</h1>
          <Field label="Display name" error={error}>
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <p>Avatar</p>
          <div className="filters">
            {avatars.map((id) => (
              <button key={id} type="button" aria-pressed={avatar === id} onClick={() => setAvatar(id)}>
                {id}
              </button>
            ))}
          </div>
          <div className="panel">
            Preview: {name || "Player"} · {avatar}
          </div>
        </>
      ) : null}
      {error && step !== 3 ? <p className="error">{error}</p> : null}
      <div className="actions">
        {step > 1 ? <Button onClick={() => setStep((value) => value - 1)}>Back</Button> : null}
        {step < 3 ? (
          <Button variant="primary" onClick={() => setStep((value) => value + 1)}>
            Continue
          </Button>
        ) : (
          <>
            <Button variant="primary" disabled={busy} onClick={() => void finish()}>
              {busy ? "Saving…" : "Enter the arcade"}
            </Button>
            <Button disabled={busy} onClick={() => void finish()}>
              Skip cosmetics
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
