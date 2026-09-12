import type { ReactNode } from "react";

export function PageIntro({ eyebrow, title, description, children }: {
  eyebrow: string; title: string; description: string; children?: ReactNode;
}) {
  return <div className="page-intro">
    <div className="page-intro-copy"><p className="kicker">{eyebrow}</p><h1 className="display">{title}</h1><p className="lede">{description}</p>{children}</div>
    <div className="page-intro-mark" aria-hidden="true"><img src="/brand/bullwave-mark.png" alt="" /></div>
  </div>;
}
