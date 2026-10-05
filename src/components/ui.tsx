import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";

const BTN: Record<BtnVariant, string> = {
  primary: "bg-ink text-ivory border border-ink hover:bg-ink-soft",
  secondary: "bg-transparent text-ink border border-ink hover:bg-ink hover:text-ivory",
  ghost: "bg-transparent text-ink-soft border border-transparent hover:border-hairline-strong",
  danger: "bg-transparent text-signal border border-signal/40 hover:bg-signal hover:text-ivory",
  gold: "bg-gold text-ivory border border-gold hover:bg-[#8f7240]",
};

export function buttonClass(variant: BtnVariant = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap uppercase tracking-[0.18em] font-medium transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none select-none",
    size === "md" ? "h-10 px-6 text-[11px]" : "h-8 px-4 text-[10px]",
    BTN[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <button {...rest} className={cx(buttonClass(variant, size), className)} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <Link {...rest} className={cx(buttonClass(variant, size), className)} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-8 mb-10 fade-up">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="display text-[44px] leading-[1.05] text-ink">{title}</h1>
        {children && <div className="mt-3 text-taupe max-w-2xl leading-relaxed">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className={cx("bg-paper border border-hairline", className)}>
      {children}
    </div>
  );
}

export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow block mb-2 text-ink-soft">
      {children}
      {required && <span className="text-signal ml-1" title="Required — blocks export">★</span>}
    </label>
  );
}

export const inputClass =
  "w-full h-10 bg-transparent border-0 border-b border-hairline-strong px-0 text-[14px] text-ink placeholder:text-mist focus:outline-none focus:border-ink transition-colors";

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, "cursor-pointer appearance-none bg-[length:10px] pr-6", props.className)} />;
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "ai" | "est" | "inferred" | "ok" | "signal" | "gold"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "border-hairline-strong text-taupe",
    ai: "border-gold/60 text-gold bg-gold-soft/60",
    est: "border-signal/40 text-signal bg-signal-soft/60",
    inferred: "border-ink-soft/30 text-ink-soft bg-hairline/50",
    ok: "border-ok/30 text-ok bg-ok-soft",
    signal: "border-signal/40 text-signal bg-signal-soft",
    gold: "border-gold text-gold",
  } as const;
  return (
    <span className={cx("inline-flex items-center gap-1 border px-2 h-[22px] text-[9.5px] tracking-[0.16em] uppercase font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Yellow numbered material callout, as on the printed pack. */
export function CalloutDot({ n, size = 22 }: { n: number | string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-callout text-ink border border-ink font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {n}
    </span>
  );
}

/** Red lettered comment callout. */
export function CommentDot({ letter, size = 22 }: { letter: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-signal text-ivory font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {letter}
    </span>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-hairline-strong py-16 px-6 text-center fade-up">
      <div className="display text-2xl text-ink mb-2">{title}</div>
      {children && <p className="text-taupe max-w-md mx-auto leading-relaxed">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Thumb({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (!src) return <div className={cx("bg-hairline/50 border border-hairline", className)} aria-label={alt} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cx("object-contain bg-white border border-hairline", className)} />;
}

/** Thumbnail cropped to the swatch chip when a chip box exists — the colour itself, not the whole card. */
export function SwatchThumb({
  src,
  box,
  alt,
  className,
}: {
  src?: string | null;
  box?: { x: number; y: number; w: number; h: number } | null;
  alt: string;
  className?: string;
}) {
  if (!src || !box || box.w <= 0 || box.h <= 0) return <Thumb src={src} alt={alt} className={className} />;
  const pos = (o: number, s: number) => (s >= 1 ? 0 : (o / (1 - s)) * 100);
  return (
    <div
      role="img"
      aria-label={alt}
      className={cx("border border-hairline bg-no-repeat", className)}
      style={{
        backgroundImage: `url(${src})`,
        backgroundSize: `${100 / box.w}% ${100 / box.h}%`,
        backgroundPosition: `${pos(box.x, box.w)}% ${pos(box.y, box.h)}%`,
      }}
    />
  );
}
