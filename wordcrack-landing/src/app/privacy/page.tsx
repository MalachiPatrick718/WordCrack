import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-black">Privacy Policy</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          This is a placeholder Privacy Policy for WordCrack. Replace this content before production release.
        </p>

        <div className="mt-8 space-y-6 text-white/75 leading-relaxed">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Data we collect</h2>
            <p className="mt-2">
              WordCrack may collect account identifiers, gameplay events (times, hints used), and purchase entitlement
              status to operate leaderboards and premium access.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">How we use data</h2>
            <p className="mt-2">
              We use data to provide gameplay, sync progress, prevent abuse, and show leaderboards. We do not sell
              personal information.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Contact</h2>
            <p className="mt-2">
              Email support: <span className="font-semibold">support@wordcrack.app</span>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

