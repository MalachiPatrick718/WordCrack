import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 mt-16">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="text-white/70 text-sm">
          <div className="font-semibold text-white">MindShift</div>
          <div>© {new Date().getFullYear()} MindShift. All rights reserved.</div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link className="text-white/80 hover:text-white" href="/privacy">
            Privacy
          </Link>
          <Link className="text-white/80 hover:text-white" href="/terms">
            Terms
          </Link>
          <Link className="text-white/80 hover:text-white" href="/support">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}

