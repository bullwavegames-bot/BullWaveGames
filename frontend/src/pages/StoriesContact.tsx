import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { STORIES } from "../data/content";
import { gameBySlug } from "../data/games";
import { EmptyState, Button, Field, Notice, TextArea, TextInput } from "../components/ui";
import { useApp } from "../state/AppState";
import { PRODUCT } from "../config/product";
import { PageIntro } from "../components/PageIntro";

export function StoriesPage() {
  const featured = STORIES.find((story) => story.featured) ?? STORIES[0];
  const rest = STORIES.filter((story) => story.slug !== featured.slug);
  if (!STORIES.length) return <EmptyState title="The journal is quiet." body="New studio notes will appear here." />;
  return (
    <div className="section">
      <div className="wrap">
        <PageIntro eyebrow="Stories & inspiration" title="Inside the studio." description="Meet the ideas, worlds, and little details behind your next favorite game." />
        <Link className="card game-card" to={`/stories/${featured.slug}`} style={{ marginTop: 28 }}>
          <div className="art" style={{ aspectRatio: "16 / 7" }}>
            <img src="/covers/lantern-path-hero.png" alt="" />
          </div>
          <div className="body">
            <span className="kicker">{featured.category}</span>
            <h2 className="display" style={{ fontSize: 40 }}>
              {featured.title}
            </h2>
            <p>{featured.excerpt}</p>
            <span className="meta">{featured.readingMinutes} min read</span>
          </div>
        </Link>
        <div className="grid-3" style={{ marginTop: 24 }}>
          {rest.map((story) => (
            <Link key={story.slug} className="card game-card" to={`/stories/${story.slug}`}>
              <div className="body">
                <span className="kicker">{story.category}</span>
                <h3>{story.title}</h3>
                <p className="meta">{story.excerpt}</p>
                <span className="meta">{story.readingMinutes} min</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StoryDetailPage() {
  const { slug = "" } = useParams();
  const story = STORIES.find((item) => item.slug === slug);
  if (!story) {
    return (
      <div className="section wrap">
        <h1 className="display">This page wandered out of the arcade.</h1>
        <Link to="/stories">Back to stories</Link>
      </div>
    );
  }
  const related = STORIES.filter((item) => item.slug !== story.slug).slice(0, 2);
  const game = story.relatedGameSlug ? gameBySlug(story.relatedGameSlug) : undefined;
  return (
    <div className="section">
      <div className="wrap article">
        <Link to="/stories">Back to stories</Link>
        <p className="kicker">{story.category}</p>
        <h1 className="display">{story.title}</h1>
        <p className="lede">{story.excerpt}</p>
        <p className="meta">
          {story.authorLabel} · {story.dateLabel} · {story.prototypeNote}
        </p>
        <img src="/covers/lantern-path-cover.png" alt="Lantern light over garden geometry." style={{ borderRadius: 18, margin: "20px 0" }} />
        {story.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {game ? (
          <p>
            Related game: <Link to={`/games/${game.slug}`}>{game.title}</Link>
          </p>
        ) : null}
        <h2>Related</h2>
        {related.map((item) => (
          <p key={item.slug}>
            <Link to={`/stories/${item.slug}`}>{item.title}</Link>
          </p>
        ))}
      </div>
    </div>
  );
}

export function ContactPage() {
  const { sendTicket, toast } = useApp();
  return <ContactForm send={sendTicket} toast={toast} />;
}

function ContactForm({
  send,
  toast,
}: {
  send: (ticket: { name: string; email: string; topic: string; message: string; paymentRef?: string }) => string;
  toast: (text: string, tone?: "ok" | "err" | "info") => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("Play");
  const [message, setMessage] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [ref, setRef] = useState<string | null>(null);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!email.includes("@")) next.email = "Enter a valid email.";
    if (message.trim().length < 10) next.message = "Tell us a little more.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const id = send({ name, email, topic, message, paymentRef: paymentRef || undefined });
      setRef(id);
      toast("Message sent.", "ok");
    } catch {
      toast("We couldn’t send that. Your text is still here.", "err");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section">
      <div className="wrap split">
        <div>
          <h1 className="display">Contact</h1>
          <p>Support hours, grievance contact, and a street address are placeholders until verified.</p>
          <div className="panel">
            <p>
              <strong>Legal entity</strong>
              <br />
              {PRODUCT.legalEntity}
            </p>
            <p>
              <strong>Domain</strong>
              <br />
              {PRODUCT.domain}
            </p>
            <p>
              <strong>Support</strong>
              <br />
              Placeholder: support@{PRODUCT.domain}
            </p>
            <p>
              <strong>Hours</strong>
              <br />
              Placeholder: weekday hours in {PRODUCT.timezone}
            </p>
            <p>
              <strong>Grievance</strong>
              <br />
              Placeholder: grievance contact pending verification
            </p>
            <p>
              <strong>Business address / phone</strong>
              <br />
              Not published here. Do not treat empty fields as an address.
            </p>
          </div>
          <Notice>Never send passwords, OTPs, or complete card details.</Notice>
        </div>
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {ref ? (
            <p>
              Message received. Reference {ref}.
            </p>
          ) : (
            <>
              <Field label="Name" error={errors.name}>
                <TextInput value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Email" error={errors.email}>
                <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <Field label="Topic">
                <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                  <option>Play</option>
                  <option>Membership</option>
                  <option>Payment</option>
                  <option>Account</option>
                </select>
              </Field>
              <Field label="Message" error={errors.message}>
                <TextArea value={message} onChange={(event) => setMessage(event.target.value)} />
              </Field>
              {topic === "Payment" ? (
                <Field label="Payment reference (optional)">
                  <TextInput value={paymentRef} onChange={(event) => setPaymentRef(event.target.value)} />
                </Field>
              ) : null}
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send message"}
              </Button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
