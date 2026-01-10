import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function SupportPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-black">Support</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          Questions, bug reports, or account issues? Email <span className="font-semibold">support@wordcrack.app</span>.
        </p>

        <div className="mt-8 space-y-4">
          {[
            {
              q: "How does scoring work?",
              a: "Your final time is solve time + time penalties from hints. Lower is better.",
            },
            {
              q: "How often do puzzles change?",
              a: "A new puzzle becomes available every hour (UTC).",
            },
            {
              q: "Do hints solve the puzzle?",
              a: "No—hints are designed to help without giving the full answer, and each hint adds a penalty.",
            },
          ].map((x) => (
            <div key={x.q} className="rounded-2xl border border-border bg-card p-6">
              <div className="font-extrabold">{x.q}</div>
              <div className="mt-2 text-white/70 leading-relaxed">{x.a}</div>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

