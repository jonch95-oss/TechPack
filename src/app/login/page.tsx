import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between bg-ink text-ivory p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 14px)" }} />
        <div className="relative">
          <div className="display text-[40px] tracking-[0.36em]">ICON</div>
          <div className="text-[9.5px] tracking-[0.46em] text-mist mt-2">LUXURY GROUP</div>
        </div>
        <div className="relative max-w-md">
          <p className="display italic text-[34px] leading-[1.2] text-ivory/95">
            From a single render to a factory-ready tech pack.
          </p>
          <div className="w-12 h-px bg-gold mt-8 mb-5" />
          <p className="text-[11px] tracking-[0.2em] uppercase text-mist leading-loose">
            Pink London · Off-White · Palm Angels · PLAY Palm Angels · L/AB c/o Off-White · Ted Baker · Champion
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm fade-up">
          <div className="lg:hidden display text-[34px] tracking-[0.36em] mb-10">ICON</div>
          <div className="eyebrow mb-3">Tech Pack Studio</div>
          <h1 className="display text-[40px] leading-tight mb-10">Sign in</h1>
          <LoginForm next={next} />
          <p className="mt-10 text-[11px] text-taupe leading-relaxed">Accounts are created by an administrator. Ask Jon if you need access.</p>
        </div>
      </section>
    </main>
  );
}
