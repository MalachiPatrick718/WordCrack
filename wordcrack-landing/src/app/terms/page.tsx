import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function TermsPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-black">Terms of Service</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          This is a placeholder Terms of Service for MindShift. Replace this content before production release.
        </p>

        <div className="mt-8 space-y-6 text-white/75 leading-relaxed">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Use of the app</h2>
            <p className="mt-2">
              Don’t abuse or interfere with the service, attempt to cheat leaderboards, or reverse engineer protected
              parts of the game.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Subscriptions & purchases</h2>
            <p className="mt-2">
              Premium access may be offered via subscriptions. Purchases are handled by Apple/Google billing and are
              subject to their terms.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Contact</h2>
            <p className="mt-2">
              Email support: <span className="font-semibold">support@mindshift.app</span>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

