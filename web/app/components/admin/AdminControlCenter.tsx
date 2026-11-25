"use client";

import { useMemo, useState, type ReactNode } from "react";

type Section = "overview" | "users" | "wardrobe" | "renders" | "intelligence" | "storage" | "feedback" | "settings";
type IconName = Section | "search" | "bell" | "arrow" | "more" | "spark" | "shield" | "pulse" | "lock";

type NavItem = { id: Section; label: string; note?: string };

const NAV: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users", note: "1,248" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "renders", label: "Render jobs", note: "12" },
  { id: "intelligence", label: "AI & APIs" },
  { id: "storage", label: "Data & storage" },
  { id: "feedback", label: "Feedback" },
  { id: "settings", label: "System controls" },
];

const ACTIVITY = [
  { title: "Try-on completed", detail: "3-layer look · render_8f31", time: "18 sec", tone: "emerald" },
  { title: "Gemini fallback activated", detail: "503 provider capacity · deterministic ranking used", time: "2 min", tone: "amber" },
  { title: "Wardrobe item analyzed", detail: "Cable-knit V-neck · confidence 94%", time: "4 min", tone: "blue" },
  { title: "Quota reservation rejected", detail: "Daily user limit reached · no credits spent", time: "7 min", tone: "rose" },
];

const RENDERS = [
  { id: "R-8F31", user: "aylin@sample.dev", outfit: "3-layer · 4 pieces", status: "Completed", duration: "18.4s", units: "2" },
  { id: "R-2A90", user: "deniz@sample.dev", outfit: "Simple · 2 pieces", status: "Rendering", duration: "08.2s", units: "—" },
  { id: "R-91CD", user: "guest-19ef", outfit: "Layered · 3 pieces", status: "Blocked", duration: "00.1s", units: "0" },
  { id: "R-77B2", user: "mert@sample.dev", outfit: "With layer · 3 pieces", status: "Cached", duration: "00.03s", units: "0" },
];

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = { className, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, ReactNode> = {
    overview: <><path d="M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z" /></>,
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    wardrobe: <><path d="M8 4a4 4 0 0 1 8 0c0 2-1.5 2.5-4 4" /><path d="m12 8 9 7H3zM5 15v5h14v-5" /></>,
    renders: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m9 8 7 4-7 4z" /></>,
    intelligence: <><path d="M12 3a6 6 0 0 0-3.7 10.7c.7.55 1.2 1.3 1.2 2.15V17h5v-1.15c0-.85.5-1.6 1.2-2.15A6 6 0 0 0 12 3Z" /><path d="M9.5 20h5M9.5 17h5" /></>,
    storage: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    feedback: <><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.4 9.4 0 0 1-4-.9L3 21l1.8-4.5A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.6v-.09a1.7 1.7 0 0 0-1.1-1.51 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.3.3.5.65.6 1 .1.3.1.6.1 1h.9v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    arrow: <><path d="m9 18 6-6-6-6" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    spark: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    pulse: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function StatusDot({ tone = "emerald" }: { tone?: "emerald" | "amber" | "rose" | "blue" }) {
  const colors = { emerald: "bg-emerald-500 shadow-emerald-500/30", amber: "bg-amber-500 shadow-amber-500/30", rose: "bg-rose-500 shadow-rose-500/30", blue: "bg-sky-500 shadow-sky-500/30" };
  return <span className={`inline-block h-2 w-2 rounded-full shadow-[0_0_0_4px] ${colors[tone]}`} />;
}

function MetricCard({ eyebrow, value, detail, change, accent = "sand" }: { eyebrow: string; value: string; detail: string; change?: string; accent?: "sand" | "green" | "blue" | "ink" }) {
  const accents = { sand: "from-[#d7b98b] to-[#f5ead8]", green: "from-[#9bb99c] to-[#e2eee2]", blue: "from-[#8ba9bb] to-[#e0ebf0]", ink: "from-[#45443f] to-[#a4a098]" };
  return (
    <article className="group relative overflow-hidden rounded-[22px] border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[0_12px_40px_rgba(40,37,31,.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(40,37,31,.09)]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accents[accent]}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8e8980]">{eyebrow}</p>
        {change && <span className="rounded-full bg-[#e8f1e7] px-2 py-1 text-[10px] font-bold text-[#527052]">{change}</span>}
      </div>
      <p className="mt-5 font-serif text-[34px] leading-none tracking-[-.04em] text-[#25241f]">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#7d786f]">{detail}</p>
    </article>
  );
}

function SectionTitle({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#a08459]">{kicker}</p>
        <h2 className="mt-1 font-serif text-[24px] tracking-[-.03em] text-[#25241f]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Toggle({ active, locked = false }: { active: boolean; locked?: boolean }) {
  return (
    <span aria-hidden className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${active ? "border-[#24231f] bg-[#24231f]" : "border-[#d7d3ca] bg-[#eae7df]"} ${locked ? "opacity-60" : ""}`}>
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-[22px]" : "translate-x-1"}`} />
    </span>
  );
}

function PreviewBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dcc89e] bg-[#fff8e9] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-[#856c3f]"><Icon name="lock" className="h-3 w-3" /> Design preview</span>;
}

function Overview() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard eyebrow="Active users" value="1,248" detail="182 active in the last 24 hours" change="+12.4%" accent="ink" />
        <MetricCard eyebrow="Wardrobe pieces" value="8,431" detail="312 analyzed this week" change="+8.1%" accent="sand" />
        <MetricCard eyebrow="Try-on renders" value="386" detail="94.8% successful completion" change="+16.7%" accent="blue" />
        <MetricCard eyebrow="YouCam units" value="62%" detail="438 of 700 unit safety budget used" accent="green" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.9fr]">
        <section className="rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[0_12px_40px_rgba(40,37,31,.05)]">
          <SectionTitle kicker="Operations" title="Platform rhythm" action={<button className="rounded-full border border-[#ddd8ce] px-3 py-1.5 text-[10px] font-bold text-[#615d56] transition hover:bg-[#f0ede6]">Last 7 days</button>} />
          <div className="relative mt-8 h-52 overflow-hidden rounded-2xl border border-[#e7e3da] bg-[#f7f4ed] px-4 pt-5">
            <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(#dedbd2_1px,transparent_1px),linear-gradient(90deg,#dedbd2_1px,transparent_1px)] [background-size:100%_25%,14.285%_100%]" />
            <svg className="relative h-[145px] w-full overflow-visible" viewBox="0 0 700 145" preserveAspectRatio="none" aria-label="Seven day render and recommendation volume chart">
              <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b28e5a" stopOpacity=".32" /><stop offset="1" stopColor="#b28e5a" stopOpacity="0" /></linearGradient></defs>
              <path d="M0 125 C70 118 70 95 140 100 S220 110 280 72 S355 87 420 56 S510 75 560 34 S640 55 700 18 L700 145 L0 145Z" fill="url(#chartFill)" />
              <path d="M0 125 C70 118 70 95 140 100 S220 110 280 72 S355 87 420 56 S510 75 560 34 S640 55 700 18" fill="none" stroke="#a47d45" strokeWidth="3" strokeLinecap="round" />
              {[0,140,280,420,560,700].map((x, i) => <circle key={x} cx={x} cy={[125,100,72,56,34,18][i]} r="4" fill="#fbfaf6" stroke="#a47d45" strokeWidth="2" />)}
            </svg>
            <div className="relative flex justify-between text-[9px] font-semibold uppercase tracking-wider text-[#99938a]"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[#777168]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#a47d45]" /> Recommendations 2,941</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#8ba9bb]" /> Try-ons 386</span><span className="ml-auto font-semibold text-[#4e4a43]">Peak: Sat · 19:00</span></div>
        </section>

        <section className="rounded-[24px] border border-[#2f2e29] bg-[#272621] p-5 text-[#f3efe6] shadow-[0_18px_50px_rgba(27,26,22,.2)]">
          <SectionTitle kicker="Live health" title="Systems online" action={<span className="flex items-center gap-2 text-[10px] text-[#bcb7ad]"><StatusDot /> Operational</span>} />
          <div className="mt-5 space-y-1">
            {[
              ["Supabase", "Auth, DB & private storage", "38 ms", "emerald"],
              ["Gemini Vision", "Structured stylist judging", "1.8 s", "amber"],
              ["YouCam Cloth-v4", "Virtual try-on rendering", "18.4 s", "emerald"],
              ["Open-Meteo", "Weather context", "112 ms", "emerald"],
            ].map(([name, detail, latency, tone]) => (
              <div key={name} className="flex items-center gap-3 border-b border-white/8 py-3 last:border-none">
                <StatusDot tone={tone as "emerald" | "amber"} />
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{name}</p><p className="truncate text-[10px] text-[#aaa59b]">{detail}</p></div>
                <span className="font-mono text-[10px] text-[#d8c7aa]">{latency}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-200/5 px-3 py-2 text-[10px] leading-relaxed text-[#d7c49d]">Gemini fallback rate is elevated to 7.4%. Deterministic ranking remains available.</p>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6] p-5">
          <SectionTitle kicker="Recent" title="Operational activity" action={<button className="text-[10px] font-bold text-[#9a7745]">View audit log →</button>} />
          <div className="divide-y divide-[#e9e5dd]">
            {ACTIVITY.map((item) => <div key={item.title} className="flex gap-3 py-3.5"><div className="pt-1.5"><StatusDot tone={item.tone as "emerald" | "amber" | "rose" | "blue"} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#34322c]">{item.title}</p><p className="mt-0.5 truncate text-[10px] text-[#8b867d]">{item.detail}</p></div><span className="text-[9px] text-[#aaa49a]">{item.time}</span></div>)}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6] p-5">
          <SectionTitle kicker="Guardrails" title="Safety controls" />
          <div className="space-y-3">
            {[
              ["Real try-on", "Production rendering enabled", true],
              ["Verified accounts", "Required before paid work", true],
              ["Gemini judging", "Fallback remains deterministic", true],
              ["New registrations", "Anonymous + permanent accounts", true],
            ].map(([title, detail, active]) => <div key={String(title)} className="flex items-center gap-3 rounded-2xl border border-[#e5e1d8] bg-[#f6f3ec] p-3"><div className="flex-1"><p className="text-xs font-semibold text-[#393730]">{String(title)}</p><p className="text-[10px] text-[#8d877d]">{String(detail)}</p></div><Toggle active={Boolean(active)} locked /></div>)}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[9px] text-[#948e83]"><Icon name="lock" className="h-3 w-3" /> Preview only — controls require an audited admin API.</p>
        </section>
      </div>
    </>
  );
}

function RenderJobs() {
  return (
    <section className="rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6] p-5">
      <SectionTitle kicker="Pipeline" title="Render jobs" action={<button className="rounded-full bg-[#292822] px-3 py-2 text-[10px] font-bold text-white">Export report</button>} />
      <div className="mb-4 flex flex-wrap gap-2">{["All jobs", "Rendering", "Completed", "Failed", "Cached"].map((x, i) => <button key={x} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${i === 0 ? "bg-[#292822] text-white" : "border border-[#dfdbd2] text-[#777168]"}`}>{x}</button>)}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr className="border-y border-[#e8e4dc] text-[9px] uppercase tracking-[.15em] text-[#9c968c]">{["Job", "User", "Outfit", "Status", "Duration", "Units", ""].map(x => <th key={x} className="px-3 py-3 font-bold">{x}</th>)}</tr></thead><tbody>{RENDERS.map(row => <tr key={row.id} className="border-b border-[#eeeae2] text-xs text-[#4a4740]"><td className="px-3 py-4 font-mono text-[10px] font-bold">{row.id}</td><td className="px-3 py-4">{row.user}</td><td className="px-3 py-4">{row.outfit}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.status === "Completed" ? "bg-emerald-50 text-emerald-700" : row.status === "Rendering" ? "bg-sky-50 text-sky-700" : row.status === "Blocked" ? "bg-rose-50 text-rose-700" : "bg-stone-100 text-stone-600"}`}>{row.status}</span></td><td className="px-3 py-4 font-mono text-[10px]">{row.duration}</td><td className="px-3 py-4">{row.units}</td><td className="px-3 py-4"><button aria-label={`More options for ${row.id}`}><Icon name="more" /></button></td></tr>)}</tbody></table></div>
    </section>
  );
}

function PlaceholderSection({ section }: { section: Exclude<Section, "overview" | "renders" | "settings"> }) {
  const content = {
    users: { kicker: "Identity & access", title: "User operations", summary: "Search accounts, inspect ownership-safe usage, manage access states, and trace account activity without exposing private wardrobe images.", cards: [["Permanent accounts", "836"], ["Anonymous guests", "412"], ["Verified today", "24"], ["Flagged activity", "3"]] },
    wardrobe: { kicker: "Catalog & moderation", title: "Wardrobe intelligence", summary: "Review garment analysis quality, semantic confidence, category health, failed cutouts, and catalog coverage.", cards: [["User garments", "8,431"], ["AI analyzed", "92.6%"], ["Needs review", "37"], ["Failed cutouts", "8"]] },
    intelligence: { kicker: "Model operations", title: "AI & API control", summary: "Monitor model latency, structured-output failures, fallback rates, prompt versions, provider status, and estimated request cost.", cards: [["Gemini success", "92.6%"], ["Fallback rate", "7.4%"], ["Median latency", "1.8s"], ["Prompt version", "v6"]] },
    storage: { kicker: "Infrastructure", title: "Data & storage", summary: "Track database growth, private bucket usage, signed URL traffic, orphan detection, migrations, and retention operations.", cards: [["Database", "42 MB"], ["Private storage", "684 MB"], ["Signed URLs", "3.2k"], ["Orphans", "14"]] },
    feedback: { kicker: "Learning loop", title: "Outfit feedback", summary: "Measure what people wear, reject, lock, or swap—and identify recommendations that repeatedly need correction.", cards: [["Wear this", "71%"], ["Not my style", "12%"], ["Role swaps", "286"], ["Locks used", "41%"]] },
  }[section];
  return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{content.cards.map(([k,v], i) => <MetricCard key={k} eyebrow={k} value={v} detail={i % 2 ? "Compared with previous 7 days" : "Current design-preview snapshot"} accent={(["ink","sand","blue","green"] as const)[i]} />)}</div><section className="mt-5 overflow-hidden rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6]"><div className="grid lg:grid-cols-[1fr_.75fr]"><div className="p-7"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#a08459]">{content.kicker}</p><h2 className="mt-2 font-serif text-3xl tracking-[-.04em] text-[#25241f]">{content.title}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#777168]">{content.summary}</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{["Search & filtering", "Ownership-safe detail", "Bulk actions", "Export & audit history"].map((item, i) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-[#e3dfd6] bg-[#f6f3ec] p-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white font-serif text-xs text-[#947448]">0{i+1}</span><span className="text-xs font-semibold text-[#49463f]">{item}</span></div>)}</div></div><div className="relative min-h-64 overflow-hidden border-t border-[#dedbd2] bg-[#292823] p-7 text-white lg:border-l lg:border-t-0"><div className="absolute inset-0 opacity-10 [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]" /><div className="relative"><Icon name={section} className="h-8 w-8 text-[#d5b985]" /><p className="mt-8 font-serif text-2xl">Backend connection required</p><p className="mt-3 text-xs leading-5 text-[#b9b4aa]">This design intentionally exposes no private data or privileged action. Wire it only after adding server-enforced admin roles, audit logs, and step-up confirmation for destructive operations.</p><button disabled className="mt-6 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold text-[#d0cbc0]">Connect secured admin API</button></div></div></div></section></>;
}

function SystemControls() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
      <section className="rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6] p-5"><SectionTitle kicker="Feature control" title="Platform switches" /><div className="space-y-3">{[["Real YouCam rendering","Allow new paid virtual try-on jobs",true],["Gemini visual judge","Use AI critique after deterministic validation",true],["Anonymous registrations","Allow new guest identities",true],["Wardrobe uploads","Allow new image processing jobs",true],["Maintenance mode","Pause customer operations",false]].map(([title, detail, active]) => <div key={String(title)} className="flex items-center gap-4 rounded-2xl border border-[#e4e0d7] bg-[#f6f3ec] p-4"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#393730]">{String(title)}</p><p className="mt-0.5 text-[10px] text-[#8d877d]">{String(detail)}</p></div><Toggle active={Boolean(active)} locked /></div>)}</div></section>
      <div className="space-y-5"><section className="rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6] p-5"><SectionTitle kicker="Financial guardrails" title="Usage limits" /><div className="space-y-3">{[["Daily user renders","2"],["Global daily renders","20"],["Total YouCam units","700"],["IP observation threshold","10"]].map(([label,value]) => <label key={label} className="flex items-center gap-3"><span className="flex-1 text-xs text-[#5e5a52]">{label}</span><input readOnly value={value} className="w-20 rounded-xl border border-[#ddd8ce] bg-[#f4f1ea] px-3 py-2 text-right font-mono text-xs outline-none" /></label>)}</div><button disabled className="mt-5 w-full rounded-xl bg-[#282721] py-3 text-xs font-bold text-white opacity-55">Save limits · backend required</button></section><section className="rounded-[24px] border border-rose-200 bg-[#fff9f7] p-5"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-rose-600">Danger zone</p><h3 className="mt-1 font-serif text-xl text-[#382923]">Emergency controls</h3><p className="mt-2 text-[10px] leading-5 text-[#8e6d63]">Every action must require re-authentication, a typed confirmation, a reason, and an immutable audit event.</p><div className="mt-4 flex gap-2"><button disabled className="flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-[10px] font-bold text-rose-600 opacity-60">Stop paid renders</button><button disabled className="flex-1 rounded-xl bg-rose-700 px-3 py-2 text-[10px] font-bold text-white opacity-60">Maintenance mode</button></div></section></div>
    </div>
  );
}

export default function AdminControlCenter() {
  const [section, setSection] = useState<Section>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const current = useMemo(() => NAV.find((item) => item.id === section)!, [section]);

  return (
    <div className="min-h-screen bg-[#eeece6] text-[#292822] [background-image:radial-gradient(circle_at_82%_8%,rgba(201,173,125,.18),transparent_24%),radial-gradient(circle_at_10%_75%,rgba(101,121,117,.08),transparent_30%)]">
      <div className="flex min-h-screen">
        <aside className={`${mobileNav ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-[#23231f] text-[#f5f1e8] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
          <div className="border-b border-white/8 px-5 py-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl border border-[#d1b47d]/35 bg-[#d1b47d]/10 font-serif text-lg text-[#e2c890]">T</div><div><p className="font-serif text-lg leading-none">TheLook</p><p className="mt-1 text-[8px] font-bold uppercase tracking-[.22em] text-[#908b81]">Control room</p></div></div></div>
          <div className="px-4 pt-5"><p className="px-2 text-[8px] font-bold uppercase tracking-[.2em] text-[#6f6c64]">Workspace</p><nav className="mt-2 space-y-1">{NAV.map(item => <button key={item.id} onClick={() => { setSection(item.id); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${section === item.id ? "bg-[#f0e9dc] text-[#292822] shadow-sm" : "text-[#aaa69d] hover:bg-white/5 hover:text-white"}`}><Icon name={item.id} className={`h-4 w-4 ${section === item.id ? "text-[#9e7742]" : "text-[#77736b]"}`} /><span className="flex-1 font-semibold">{item.label}</span>{item.note && <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${section === item.id ? "bg-[#ddd0ba] text-[#745a36]" : "bg-white/5 text-[#7f7b73]"}`}>{item.note}</span>}</button>)}</nav></div>
          <div className="mt-auto p-4"><div className="rounded-2xl border border-white/8 bg-white/[.035] p-3"><div className="flex items-center gap-2"><StatusDot /><p className="text-[10px] font-semibold">Production healthy</p></div><p className="mt-2 text-[9px] leading-4 text-[#858178]">4 integrations monitored<br />Last check 28 seconds ago</p></div><div className="mt-3 flex items-center gap-3 px-2 py-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#d2b986] text-xs font-bold text-[#393026]">AS</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold">Abdullah Salik</p><p className="text-[8px] text-[#817d74]">Owner · Super admin</p></div><Icon name="more" className="h-4 w-4 text-[#77736b]" /></div></div>
        </aside>
        {mobileNav && <button aria-label="Close admin navigation" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden" />}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#dcd9d1]/80 bg-[#eeece6]/85 px-4 py-3 backdrop-blur-xl sm:px-6 xl:px-8"><div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-[#dad6cd] bg-white lg:hidden" aria-label="Open navigation"><span className="space-y-1"><i className="block h-px w-4 bg-current" /><i className="block h-px w-4 bg-current" /><i className="block h-px w-4 bg-current" /></span></button><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate font-serif text-xl tracking-[-.03em]">{current.label}</h1><PreviewBadge /></div><p className="mt-0.5 hidden text-[9px] text-[#8d887f] sm:block">Operations, intelligence, cost and product health in one place</p></div><div className="hidden w-64 items-center gap-2 rounded-full border border-[#dad6cd] bg-[#f8f6f1] px-3 py-2 md:flex"><Icon name="search" className="h-3.5 w-3.5 text-[#928c82]" /><input aria-label="Search admin data" placeholder="Search users, jobs, items…" className="w-full bg-transparent text-[10px] outline-none placeholder:text-[#aaa49a]" /><kbd className="rounded border border-[#ddd8cf] bg-white px-1.5 py-0.5 text-[8px] text-[#9a958c]">⌘K</kbd></div><button className="relative grid h-9 w-9 place-items-center rounded-full border border-[#dad6cd] bg-[#f8f6f1]"><Icon name="bell" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" /></button></div></header>

          <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8"><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#9a7745]">Wednesday · 25 November</p><h2 className="mt-1 font-serif text-3xl tracking-[-.045em] text-[#24231f]">{section === "overview" ? "Good evening, Abdullah." : current.label}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#7e7970]">{section === "overview" ? "Everything important across TheLook, from styling intelligence to paid render safety." : "A production-minded design for the secured administration surface."}</p></div><div className="flex items-center gap-2"><button className="rounded-full border border-[#d9d5cc] bg-[#f8f6f1] px-3 py-2 text-[10px] font-bold text-[#615d56]">Download report</button><button className="flex items-center gap-2 rounded-full bg-[#292822] px-3 py-2 text-[10px] font-bold text-white"><Icon name="pulse" className="h-3.5 w-3.5" /> Live monitor</button></div></div>
            {section === "overview" ? <Overview /> : section === "renders" ? <RenderJobs /> : section === "settings" ? <SystemControls /> : <PlaceholderSection section={section} />}
          </div>
        </main>
      </div>
    </div>
  );
}
