import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-black">Privacy Policy</h1>
        <p className="mt-4 text-white/70 leading-relaxed">Last updated: January 11, 2026</p>

        <div className="mt-8 space-y-6 text-white/75 leading-relaxed">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Overview</h2>
            <p className="mt-2">
              This Privacy Policy explains how MindShift collects, uses, and shares information when you use the MindShift mobile
              app.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Information we collect</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>
                <span className="font-semibold text-white">Account information (optional):</span> If you create an account, we collect
                your sign-in identifier (such as email) through our authentication provider.
              </li>
              <li>
                <span className="font-semibold text-white">Profile information (optional):</span> Username, avatar, and optional location
                (e.g., state) that you choose to provide.
              </li>
              <li>
                <span className="font-semibold text-white">Gameplay information:</span> Puzzle attempts, solve times, penalties, hints used,
                and related gameplay events.
              </li>
              <li>
                <span className="font-semibold text-white">Feedback:</span> If you submit feedback, we collect the message and optional context
                you provide.
              </li>
              <li>
                <span className="font-semibold text-white">Device/diagnostic data:</span> Basic technical data needed to operate the app (e.g.,
                crash/diagnostic info).
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">How we use information</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Provide core gameplay features (puzzles, attempts, hints, results)</li>
              <li>Show leaderboards and rankings</li>
              <li>Maintain your profile (if you create one)</li>
              <li>Enforce limits and prevent abuse</li>
              <li>Respond to feedback and improve the app</li>
              <li>Send notifications only if you enable them</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Sharing</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>
                <span className="font-semibold text-white">Leaderboards:</span> If you appear on leaderboards, your username, avatar, location
                (if provided), and performance metrics may be visible to other players.
              </li>
              <li>
                <span className="font-semibold text-white">Service providers:</span> We use providers to host and operate the app. They process
                data on our behalf to provide the service.
              </li>
              <li>
                <span className="font-semibold text-white">Legal:</span> We may disclose information if required by law or to protect rights and
                safety.
              </li>
            </ul>
            <p className="mt-3">We do not sell your personal information.</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Your choices</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>You can play in Guest Mode without creating an account.</li>
              <li>You can choose whether to provide profile details like location.</li>
              <li>You can disable notifications at any time in the app or device settings.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-extrabold text-white">Contact</h2>
            <p className="mt-2">
              Questions or requests? Email <span className="font-semibold">support@mindshift.app</span>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

