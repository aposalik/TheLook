"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminRenderSettings, AdminSnapshot, AdminUserSummary, AdminWardrobeSummary } from "@/lib/admin-types";
import { useAuth } from "@/app/components/auth/AuthProvider";

type Section = "overview" | "users" | "wardrobe" | "renders" | "intelligence" | "storage" | "feedback" | "settings";
type IconName = Section | "search" | "bell" | "more" | "shield" | "pulse" | "lock" | "refresh" | "warning" | "check" | "x";
type ConfirmAction =
  | { kind: "user"; action: "suspend" | "restore"; user: AdminUserSummary }
  | { kind: "wardrobe"; item: AdminWardrobeSummary }
  | null;

const NAV: Array<{ id: Section; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "renders", label: "Render jobs" },
  { id: "intelligence", label: "AI & APIs" },
  { id: "storage", label: "Data & storage" },
  { id: "feedback", label: "Feedback" },
  { id: "settings", label: "System controls" },
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
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 15a1.7 1.7 0 0 0 .4 1.9l-2.5 2.5a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21h-4v-.5A1.7 1.7 0 0 0 9 19a1.7 1.7 0 0 0-1.9.4l-2.5-2.5A1.7 1.7 0 0 0 5 15a1.7 1.7 0 0 0-1.5-1H3v-4h.5A1.7 1.7 0 0 0 5 9a1.7 1.7 0 0 0-.4-1.9l2.5-2.5A1.7 1.7 0 0 0 9 5a1.7 1.7 0 0 0 1-1.5V3h4v.5A1.7 1.7 0 0 0 15 5a1.7 1.7 0 0 0 1.9-.4l2.5 2.5A1.7 1.7 0 0 0 19 9a1.7 1.7 0 0 0 1.5 1h.5v4h-.5a1.7 1.7 0 0 0-1.5 1Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    pulse: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    refresh: <><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M6.1 9A7 7 0 0 1 18.5 6.5L20 11M4 13l1.5 4.5A7 7 0 0 0 17.9 15" /></>,
    warning: <><path d="M10.3 3.5 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    x: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function formatNumber(value: number) { return new Intl.NumberFormat("en-US").format(value); }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function compactId(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
function isBanned(user: AdminUserSummary) { return Boolean(user.bannedUntil && new Date(user.bannedUntil) > new Date()); }

function StatusDot({ tone = "emerald" }: { tone?: "emerald" | "amber" | "rose" | "blue" }) {
  const color = { emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500", blue: "bg-sky-500" }[tone];
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[24px] border border-[#dedbd2] bg-[#fbfaf6] shadow-[0_12px_40px_rgba(40,37,31,.05)] ${className}`}>{children}</section>;
}

function MetricCard({ label, value, detail, tone = "sand" }: { label: string; value: string; detail: string; tone?: "sand" | "blue" | "green" | "ink" }) {
  const accent = { sand: "bg-[#c6a46f]", blue: "bg-[#7f9fae]", green: "bg-[#849f84]", ink: "bg-[#494741]" }[tone];
  return <Card className="relative overflow-hidden p-5"><span className={`absolute inset-x-0 top-0 h-1 ${accent}`} /><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#8e8980]">{label}</p><p className="mt-5 font-serif text-[34px] leading-none tracking-[-.04em] text-[#25241f]">{value}</p><p className="mt-2 text-[10px] leading-4 text-[#7d786f]">{detail}</p></Card>;
}

function SectionTitle({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#a08459]">{kicker}</p><h3 className="mt-1 font-serif text-[24px] tracking-[-.03em] text-[#25241f]">{title}</h3></div>{action}</div>;
}

function Empty({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-dashed border-[#d9d5cc] bg-[#f7f4ee] px-5 py-10 text-center text-xs text-[#888279]">{children}</div>; }

function TableShell({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-y border-[#e8e4dc] text-[8px] uppercase tracking-[.15em] text-[#9c968c]">{headers.map((header) => <th key={header} className="px-3 py-3 font-bold">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Overview({ data }: { data: AdminSnapshot }) {
  const successRate = data.counts.renderJobs ? Math.round((data.counts.completedRenders / data.counts.renderJobs) * 1000) / 10 : 0;
  const budgetPercent = data.settings.globalTotalUnitLimit ? Math.min(100, Math.round((data.usage.totalUnits / data.settings.globalTotalUnitLimit) * 100)) : 0;
  const activities = [
    ...data.audit.slice(0, 5).map((event) => ({ title: event.action, detail: `${event.targetType} · ${event.reason}`, at: event.createdAt, tone: "amber" as const })),
    ...data.renders.slice(0, 5).map((job) => ({ title: `Render ${job.status}`, detail: `${job.selectedItemCount} items · ${job.youcamUnits} units`, at: job.createdAt, tone: job.status === "completed" ? "emerald" as const : job.status === "failed" ? "rose" as const : "blue" as const })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 7);
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Users" value={formatNumber(data.counts.users)} detail={`${formatNumber(data.counts.permanentUsers)} permanent · ${formatNumber(data.counts.anonymousUsers)} guests`} tone="ink" />
      <MetricCard label="Wardrobe pieces" value={formatNumber(data.counts.wardrobeItems)} detail={`${formatNumber(data.counts.savedLooks)} saved looks`} />
      <MetricCard label="Try-on renders" value={formatNumber(data.counts.renderJobs)} detail={`${successRate}% completion rate`} tone="blue" />
      <MetricCard label="YouCam budget" value={`${budgetPercent}%`} detail={`${formatNumber(data.usage.totalUnits)} of ${formatNumber(data.settings.globalTotalUnitLimit)} units used`} tone="green" />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_.85fr]">
      <Card className="p-5"><SectionTitle kicker="Live activity" title="Operations feed" />{activities.length ? <div className="divide-y divide-[#e9e5dd]">{activities.map((item, index) => <div key={`${item.at}-${index}`} className="flex items-start gap-3 py-3.5"><div className="pt-1"><StatusDot tone={item.tone} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#34322c]">{item.title}</p><p className="mt-0.5 truncate text-[10px] text-[#8b867d]">{item.detail}</p></div><span className="text-[9px] text-[#aaa49a]">{formatDate(item.at)}</span></div>)}</div> : <Empty>No activity recorded yet.</Empty>}</Card>
      <Card className="bg-[#272621] p-5 text-[#f3efe6]"><SectionTitle kicker="Environment" title="Integration readiness" /><div className="space-y-1">{[["Supabase", data.integrations.supabase, "Auth, database and private storage"], ["Gemini", data.integrations.gemini, "Visual judging and garment analysis"], ["YouCam Cloth-v4", data.integrations.youcam, "Paid virtual try-on rendering"], ["Open-Meteo", data.integrations.weather, "Weather-aware styling"]].map(([name, ready, detail]) => <div key={String(name)} className="flex items-center gap-3 border-b border-white/8 py-3 last:border-none"><StatusDot tone={ready ? "emerald" : "rose"} /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{String(name)}</p><p className="truncate text-[9px] text-[#aaa59b]">{String(detail)}</p></div><span className={`text-[9px] font-bold ${ready ? "text-emerald-300" : "text-rose-300"}`}>{ready ? "Configured" : "Missing"}</span></div>)}</div><div className="mt-4 rounded-xl border border-white/10 bg-white/[.04] p-3"><p className="text-[10px] font-semibold">Today</p><p className="mt-1 text-[9px] leading-4 text-[#aaa59b]">{data.usage.todayRenders} new renders · {data.usage.todayUnits} YouCam units</p></div></Card>
    </div>
  </>;
}

function Users({ data, onAction }: { data: AdminSnapshot; onAction: (action: ConfirmAction) => void }) {
  return <Card className="p-5"><SectionTitle kicker="Identity & access" title="Recent users" action={<span className="text-[10px] text-[#8a847b]">Showing {data.users.length} of {formatNumber(data.counts.users)}</span>} />{data.users.length ? <TableShell headers={["Account", "Type", "Provider", "Created", "Last sign-in", "Status", "Action"]}>{data.users.map((user) => { const banned = isBanned(user); return <tr key={user.id} className="border-b border-[#eeeae2] text-xs text-[#4a4740]"><td className="px-3 py-4"><p className="max-w-[220px] truncate font-semibold">{user.email ?? compactId(user.id)}</p><p className="mt-1 font-mono text-[8px] text-[#a09a90]">{compactId(user.id)}</p></td><td className="px-3 py-4"><span className="rounded-full bg-[#f0ede6] px-2 py-1 text-[9px] font-bold">{user.isAnonymous ? "Guest" : "Permanent"}</span></td><td className="px-3 py-4 capitalize">{user.provider}</td><td className="px-3 py-4 text-[10px]">{formatDate(user.createdAt)}</td><td className="px-3 py-4 text-[10px]">{formatDate(user.lastSignInAt)}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${banned ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{banned ? "Suspended" : "Active"}</span></td><td className="px-3 py-4"><button onClick={() => onAction({ kind: "user", action: banned ? "restore" : "suspend", user })} className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-bold ${banned ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"}`}>{banned ? "Restore" : "Suspend"}</button></td></tr>; })}</TableShell> : <Empty>No users found.</Empty>}</Card>;
}

function Wardrobe({ data, onAction }: { data: AdminSnapshot; onAction: (action: ConfirmAction) => void }) {
  return <><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="All garments" value={formatNumber(data.counts.wardrobeItems)} detail="Private user-owned metadata" /><MetricCard label="Recent sample" value={String(data.wardrobe.length)} detail="Latest records loaded safely" tone="blue" /><MetricCard label="Saved looks" value={formatNumber(data.counts.savedLooks)} detail="Looks linked to wardrobe snapshots" tone="green" /></div><Card className="mt-5 p-5"><SectionTitle kicker="Moderation" title="Recent wardrobe items" />{data.wardrobe.length ? <TableShell headers={["Garment", "Owner", "Category", "Layer", "Uploaded", "Action"]}>{data.wardrobe.map((item) => <tr key={item.id} className="border-b border-[#eeeae2] text-xs text-[#4a4740]"><td className="px-3 py-4"><p className="font-semibold">{item.title}</p><p className="mt-1 font-mono text-[8px] text-[#a09a90]">{compactId(item.id)}</p></td><td className="px-3 py-4 font-mono text-[9px]">{compactId(item.userId)}</td><td className="px-3 py-4 capitalize">{item.category}</td><td className="px-3 py-4 capitalize">{item.layer ?? "—"}</td><td className="px-3 py-4 text-[10px]">{formatDate(item.createdAt)}</td><td className="px-3 py-4"><button onClick={() => onAction({ kind: "wardrobe", item })} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[9px] font-bold text-rose-700">Delete</button></td></tr>)}</TableShell> : <Empty>No wardrobe items found.</Empty>}</Card></>;
}

function Renders({ data }: { data: AdminSnapshot }) {
  return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="All jobs" value={formatNumber(data.counts.renderJobs)} detail="Every reserved try-on" tone="ink" /><MetricCard label="Completed" value={formatNumber(data.counts.completedRenders)} detail="Successfully stored renders" tone="green" /><MetricCard label="Failed" value={formatNumber(data.counts.failedRenders)} detail="Failed or refunded jobs" tone="sand" /><MetricCard label="Today" value={formatNumber(data.usage.todayRenders)} detail={`${data.usage.todayUnits} units consumed`} tone="blue" /></div><Card className="mt-5 p-5"><SectionTitle kicker="Pipeline" title="Recent render jobs" />{data.renders.length ? <TableShell headers={["Job", "User", "Items", "Status", "Units", "Created", "Completed / error"]}>{data.renders.map((job) => <tr key={job.id} className="border-b border-[#eeeae2] text-xs text-[#4a4740]"><td className="px-3 py-4 font-mono text-[9px]">{compactId(job.id)}</td><td className="px-3 py-4 font-mono text-[9px]">{compactId(job.userId)}</td><td className="px-3 py-4">{job.selectedItemCount}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${job.status === "completed" ? "bg-emerald-50 text-emerald-700" : job.status === "failed" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"}`}>{job.status}</span></td><td className="px-3 py-4">{job.youcamUnits}</td><td className="px-3 py-4 text-[10px]">{formatDate(job.createdAt)}</td><td className="px-3 py-4 text-[10px]">{job.errorCode ?? formatDate(job.completedAt)}</td></tr>)}</TableShell> : <Empty>No render jobs found.</Empty>}</Card></>;
}

function Intelligence({ data }: { data: AdminSnapshot }) {
  const integrations = [["Gemini Vision", data.integrations.gemini, "Garment semantics and structured outfit judging", "GEMINI_API_KEY"], ["YouCam Cloth-v4", data.integrations.youcam, "Multi-stage virtual try-on rendering", "PERFECTCORP_KEY"], ["Supabase", data.integrations.supabase, "Auth, RLS, database and private object storage", "Service role + project URL"], ["Open-Meteo", data.integrations.weather, "Location-aware forecast context", "No key required"]] as const;
  return <div className="grid gap-5 lg:grid-cols-2">{integrations.map(([name, ready, description, requirement]) => <Card key={name} className="p-5"><div className="flex items-start gap-4"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${ready ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}><Icon name={ready ? "check" : "warning"} className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-serif text-xl">{name}</h3><span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase ${ready ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{ready ? "Configured" : "Missing"}</span></div><p className="mt-2 text-xs leading-5 text-[#7d776e]">{description}</p><p className="mt-4 rounded-xl bg-[#f4f1ea] px-3 py-2 font-mono text-[9px] text-[#777168]">{requirement}</p></div></div></Card>)}</div>;
}

function DataAndStorage({ data }: { data: AdminSnapshot }) {
  return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Wardrobe rows" value={formatNumber(data.counts.wardrobeItems)} detail="Private metadata + storage paths" /><MetricCard label="Saved looks" value={formatNumber(data.counts.savedLooks)} detail="Look and item snapshots" tone="green" /><MetricCard label="Feedback rows" value={formatNumber(data.counts.feedbackEvents)} detail="Bounded personalization events" tone="blue" /><MetricCard label="Audit events" value={formatNumber(data.audit.length)} detail="Latest privileged changes loaded" tone="ink" /></div><Card className="mt-5 p-5"><SectionTitle kicker="Security model" title="Private data boundaries" /><div className="grid gap-3 md:grid-cols-3">{[["avatars", "avatars/{user_id}/{avatar_id}.jpg"], ["wardrobe", "wardrobe/{user_id}/{item_id}.png"], ["renders", "renders/{user_id}/{job_id}.jpg"]].map(([bucket,path]) => <div key={bucket} className="rounded-2xl border border-[#e4e0d7] bg-[#f6f3ec] p-4"><p className="text-xs font-bold capitalize">{bucket}</p><p className="mt-2 break-all font-mono text-[9px] leading-4 text-[#8b857b]">{path}</p><p className="mt-3 flex items-center gap-2 text-[9px] font-semibold text-emerald-700"><Icon name="shield" className="h-3 w-3" /> Private · owner scoped</p></div>)}</div></Card></>;
}

function Feedback({ data }: { data: AdminSnapshot }) {
  return <><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Feedback events" value={formatNumber(data.counts.feedbackEvents)} detail="Wear-this and not-my-style signals" tone="ink" /><MetricCard label="Saved looks" value={formatNumber(data.counts.savedLooks)} detail="Explicit user intent" tone="green" /><MetricCard label="Personalization" value="Bounded" detail="Never bypasses hard fashion constraints" tone="sand" /></div><Card className="mt-5 p-6"><SectionTitle kicker="Learning loop" title="How feedback is used" /><div className="grid gap-4 md:grid-cols-3">{[["01", "Capture", "Like/dislike, locks and role swaps become explicit signals."], ["02", "Compare", "Similarity is computed against garment IDs and outfit structure."], ["03", "Bound", "Preference adjustments remain capped below physical and safety rules."]].map(([n,t,d]) => <div key={n} className="rounded-2xl border border-[#e3dfd6] bg-[#f6f3ec] p-4"><p className="font-serif text-lg text-[#9a7745]">{n}</p><p className="mt-3 text-xs font-bold">{t}</p><p className="mt-2 text-[10px] leading-5 text-[#817b72]">{d}</p></div>)}</div></Card></>;
}

function Settings({ settings, saving, onSave }: { settings: AdminRenderSettings; saving: boolean; onSave: (settings: AdminRenderSettings, reason: string, confirmation: string) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const numberField = (key: keyof AdminRenderSettings, label: string) => <label className="flex items-center gap-3"><span className="flex-1 text-xs text-[#5e5a52]">{label}</span><input type="number" min={key === "ipDailyObserveThreshold" ? 1 : 0} value={String(draft[key])} onChange={(event) => setDraft((old) => ({ ...old, [key]: Math.max(key === "ipDailyObserveThreshold" ? 1 : 0, Number(event.target.value) || 0) }))} className="w-24 rounded-xl border border-[#ddd8ce] bg-white px-3 py-2 text-right font-mono text-xs outline-none focus:border-[#a78555]" /></label>;
  return <div className="grid gap-5 xl:grid-cols-[1fr_.85fr]"><Card className="p-5"><SectionTitle kicker="Paid operations" title="Render controls" /><div className="space-y-3">{[["Real YouCam rendering", "Allow new paid rendering jobs", "realTryonEnabled"], ["Verified account required", "Reject guests before paid work", "verifiedAccountRequired"]].map(([title, detail, key]) => { const typedKey = key as "realTryonEnabled" | "verifiedAccountRequired"; return <button key={key} onClick={() => setDraft((old) => ({ ...old, [typedKey]: !old[typedKey] }))} className="flex w-full items-center gap-4 rounded-2xl border border-[#e4e0d7] bg-[#f6f3ec] p-4 text-left"><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{title}</p><p className="mt-0.5 text-[10px] text-[#8d877d]">{detail}</p></div><span className={`relative h-6 w-11 rounded-full ${draft[typedKey] ? "bg-[#292822]" : "bg-[#d8d3c9]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${draft[typedKey] ? "left-6" : "left-1"}`} /></span></button>; })}</div><div className="mt-6 space-y-3">{numberField("userDailyTryonLimit", "Daily renders per user")}{numberField("globalDailyTryonLimit", "Global daily renders")}{numberField("globalTotalUnitLimit", "Total YouCam unit ceiling")}{numberField("ipDailyObserveThreshold", "IP observation threshold")}</div></Card><div className="space-y-5"><Card className="p-5"><SectionTitle kicker="Audit requirement" title="Reason for change" /><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are these production controls changing?" className="min-h-24 w-full resize-none rounded-2xl border border-[#ddd8ce] bg-white p-3 text-xs outline-none focus:border-[#a78555]" />{!draft.realTryonEnabled && <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type STOP REAL RENDERS" className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-mono text-xs outline-none" />}<button disabled={saving || reason.trim().length < 3 || (!draft.realTryonEnabled && confirmation !== "STOP REAL RENDERS")} onClick={() => void onSave(draft, reason, confirmation)} className="mt-4 w-full rounded-xl bg-[#292822] py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-35">{saving ? "Saving audited change…" : "Save production controls"}</button></Card><Card className="border-rose-200 bg-[#fff9f7] p-5"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-rose-600">Safety rule</p><h3 className="mt-1 font-serif text-xl text-[#382923]">Every change is attributable</h3><p className="mt-2 text-[10px] leading-5 text-[#8e6d63]">The server authenticates the admin, validates the values, requires an operational reason, and appends an audit record before changing render settings.</p></Card></div></div>;
}

function ConfirmDialog({ action, busy, onClose, onConfirm }: { action: Exclude<ConfirmAction, null>; busy: boolean; onClose: () => void; onConfirm: (reason: string, confirmation: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const expected = action.kind === "user" ? action.action.toUpperCase() : action.item.id;
  const title = action.kind === "user" ? `${action.action === "suspend" ? "Suspend" : "Restore"} account` : "Delete wardrobe item";
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-[26px] border border-white/20 bg-[#fbfaf6] p-6 shadow-2xl"><div className="flex items-start gap-4"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-700"><Icon name="warning" className="h-5 w-5" /></div><div className="flex-1"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-rose-600">Privileged action</p><h3 id="confirm-title" className="mt-1 font-serif text-2xl">{title}</h3></div><button onClick={onClose} aria-label="Close"><Icon name="x" /></button></div><p className="mt-4 text-xs leading-5 text-[#777168]">{action.kind === "user" ? `${action.user.email ?? action.user.id}. This changes authentication access immediately.` : `${action.item.title}. This removes its database record and private Storage object.`}</p><label className="mt-5 block text-[9px] font-bold uppercase tracking-wider text-[#817b72]">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#ddd8ce] bg-white p-3 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#a78555]" /></label><label className="mt-3 block text-[9px] font-bold uppercase tracking-wider text-[#817b72]">Type <span className="font-mono text-rose-700">{expected}</span><input id="admin-confirmation" className="mt-2 w-full rounded-xl border border-[#ddd8ce] bg-white px-3 py-2 font-mono text-xs font-normal normal-case tracking-normal outline-none focus:border-rose-400" /></label><div className="mt-5 flex gap-2"><button onClick={onClose} className="flex-1 rounded-xl border border-[#ddd8ce] py-2.5 text-xs font-bold">Cancel</button><button disabled={busy || reason.trim().length < 3} onClick={() => { const input = document.getElementById("admin-confirmation") as HTMLInputElement | null; if (input?.value === expected) void onConfirm(reason, input.value); }} className="flex-1 rounded-xl bg-rose-700 py-2.5 text-xs font-bold text-white disabled:opacity-35">{busy ? "Applying…" : "Confirm action"}</button></div></div></div>;
}

function LoadingScreen() { return <div className="grid min-h-screen place-items-center bg-[#eeece6]"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#d5c6ac] border-t-[#292822]" /><p className="mt-4 font-serif text-xl">Opening the control room</p><p className="mt-1 text-[10px] text-[#8a847b]">Authenticating and loading operational data</p></div></div>; }
function ErrorScreen({ status, message, identity, retry }: { status: number | null; message: string; identity: string; retry: () => void }) { return <div className="grid min-h-screen place-items-center bg-[#eeece6] p-6"><Card className="max-w-lg p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-700"><Icon name={status === 403 ? "lock" : "warning"} className="h-6 w-6" /></div><p className="mt-5 text-[9px] font-bold uppercase tracking-[.2em] text-rose-600">{status === 403 ? "Access denied" : status === 401 ? "Authentication required" : "Control room unavailable"}</p><h1 className="mt-2 font-serif text-3xl">{status === 403 ? "This account is not an admin." : "The admin backend needs attention."}</h1><p className="mt-3 text-xs leading-6 text-[#777168]">{message}</p><p className="mt-3 rounded-xl bg-[#f2eee6] px-3 py-2 font-mono text-[10px] text-[#766f65]">Browser identity: {identity}</p><div className="mt-6 flex justify-center gap-2"><Link href="/" className="rounded-full border border-[#d7d1c7] px-5 py-2.5 text-xs font-bold">Open account sign-in</Link><button onClick={retry} className="rounded-full bg-[#292822] px-5 py-2.5 text-xs font-bold text-white">Try again</button></div></Card></div>; }

export default function AdminControlCenter() {
  const { session, user, isGuest } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number | null; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [mutating, setMutating] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const current = useMemo(() => NAV.find((item) => item.id === section)!, [section]);
  const accessToken = session?.access_token ?? "";
  const bearerHeaders = useMemo<Record<string, string>>(
    (): Record<string, string> => accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    [accessToken],
  );

  const load = useCallback(async () => {
    setLoading((value) => snapshot ? value : true);
    setError(null);
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store", headers: bearerHeaders });
      const body = await response.json() as AdminSnapshot & { error?: string };
      if (!response.ok) throw Object.assign(new Error(body.error ?? "Could not load admin data."), { status: response.status });
      setSnapshot(body);
    } catch (loadError) {
      const typed = loadError as Error & { status?: number };
      setError({ status: typed.status ?? null, message: typed.message });
    } finally { setLoading(false); }
  }, [bearerHeaders, snapshot]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 4500); return () => window.clearTimeout(timer); }, [notice]);

  async function applyConfirmed(reason: string, confirmation: string) {
    if (!confirmAction) return;
    setMutating(true);
    try {
      const userAction = confirmAction.kind === "user";
      const response = await fetch(userAction ? "/api/admin/users" : "/api/admin/wardrobe", {
        method: userAction ? "PATCH" : "DELETE",
        headers: { "content-type": "application/json", ...bearerHeaders },
        body: JSON.stringify(userAction ? { userId: confirmAction.user.id, action: confirmAction.action, reason, confirmation } : { itemId: confirmAction.item.id, reason, confirmation }),
      });
      const body = await response.json() as { error?: string; warning?: string };
      if (!response.ok) throw new Error(body.error ?? "Admin action failed.");
      setNotice(body.warning ?? "Admin action completed and audited.");
      setConfirmAction(null);
      await load();
    } catch (mutationError) { setNotice(mutationError instanceof Error ? mutationError.message : "Admin action failed."); }
    finally { setMutating(false); }
  }

  async function saveSettings(settings: AdminRenderSettings, reason: string, confirmation: string) {
    setSettingsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json", ...bearerHeaders }, body: JSON.stringify({ settings, reason, confirmation }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not save settings.");
      setNotice("Production controls updated and audited.");
      await load();
    } catch (settingsError) { setNotice(settingsError instanceof Error ? settingsError.message : "Could not save settings."); }
    finally { setSettingsSaving(false); }
  }

  if (loading && !snapshot) return <LoadingScreen />;
  if (error && !snapshot) return <ErrorScreen status={error.status} message={error.message} identity={isGuest ? "anonymous guest" : user?.email ?? "no browser session"} retry={() => void load()} />;
  if (!snapshot) return null;

  const content = section === "overview" ? <Overview data={snapshot} />
    : section === "users" ? <Users data={snapshot} onAction={setConfirmAction} />
    : section === "wardrobe" ? <Wardrobe data={snapshot} onAction={setConfirmAction} />
    : section === "renders" ? <Renders data={snapshot} />
    : section === "intelligence" ? <Intelligence data={snapshot} />
    : section === "storage" ? <DataAndStorage data={snapshot} />
    : section === "feedback" ? <Feedback data={snapshot} />
    : <Settings key={snapshot.generatedAt} settings={snapshot.settings} saving={settingsSaving} onSave={saveSettings} />;

  return <div className="min-h-screen bg-[#eeece6] text-[#292822] [background-image:radial-gradient(circle_at_82%_8%,rgba(201,173,125,.18),transparent_24%),radial-gradient(circle_at_10%_75%,rgba(101,121,117,.08),transparent_30%)]"><div className="flex min-h-screen">
    <aside className={`${mobileNav ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-[#23231f] text-[#f5f1e8] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}><div className="border-b border-white/8 px-5 py-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl border border-[#d1b47d]/35 bg-[#d1b47d]/10 font-serif text-lg text-[#e2c890]">T</div><div><p className="font-serif text-lg leading-none">TheLook</p><p className="mt-1 text-[8px] font-bold uppercase tracking-[.22em] text-[#908b81]">Control room</p></div></div></div><nav className="space-y-1 px-4 pt-5">{NAV.map((item) => <button key={item.id} onClick={() => { setSection(item.id); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${section === item.id ? "bg-[#f0e9dc] text-[#292822]" : "text-[#aaa69d] hover:bg-white/5 hover:text-white"}`}><Icon name={item.id} className={`h-4 w-4 ${section === item.id ? "text-[#9e7742]" : "text-[#77736b]"}`} /><span className="flex-1 font-semibold">{item.label}</span>{item.id === "users" && <span className="text-[8px]">{formatNumber(snapshot.counts.users)}</span>}{item.id === "renders" && <span className="text-[8px]">{formatNumber(snapshot.counts.renderJobs)}</span>}</button>)}</nav><div className="mt-auto p-4"><div className="rounded-2xl border border-white/8 bg-white/[.035] p-3"><div className="flex items-center gap-2"><StatusDot /><p className="text-[10px] font-semibold">Admin API connected</p></div><p className="mt-2 text-[9px] leading-4 text-[#858178]">Updated {formatDate(snapshot.generatedAt)}</p></div><div className="mt-3 flex items-center gap-3 px-2 py-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#d2b986] text-xs font-bold text-[#393026]">AS</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold">{snapshot.actor.email ?? compactId(snapshot.actor.id)}</p><p className="text-[8px] text-[#817d74]">Authorized administrator</p></div></div></div></aside>
    {mobileNav && <button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden" />}
    <main className="min-w-0 flex-1"><header className="sticky top-0 z-20 border-b border-[#dcd9d1]/80 bg-[#eeece6]/85 px-4 py-3 backdrop-blur-xl sm:px-6 xl:px-8"><div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-[#dad6cd] bg-white lg:hidden" aria-label="Open navigation"><span className="space-y-1"><i className="block h-px w-4 bg-current" /><i className="block h-px w-4 bg-current" /><i className="block h-px w-4 bg-current" /></span></button><div className="min-w-0 flex-1"><h1 className="truncate font-serif text-xl tracking-[-.03em]">{current.label}</h1><p className="mt-0.5 hidden text-[9px] text-[#8d887f] sm:block">Live operational control with audited privileged actions</p></div><div className="hidden w-64 items-center gap-2 rounded-full border border-[#dad6cd] bg-[#f8f6f1] px-3 py-2 md:flex"><Icon name="search" className="h-3.5 w-3.5 text-[#928c82]" /><span className="text-[10px] text-[#aaa49a]">Search is scoped per section</span></div><button onClick={() => void load()} disabled={loading} aria-label="Refresh admin data" className="grid h-9 w-9 place-items-center rounded-full border border-[#dad6cd] bg-[#f8f6f1]"><Icon name="refresh" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button><button className="relative grid h-9 w-9 place-items-center rounded-full border border-[#dad6cd] bg-[#f8f6f1]" aria-label="Notifications"><Icon name="bell" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" /></button></div></header>
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8"><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#9a7745]">Production control room</p><h2 className="mt-1 font-serif text-3xl tracking-[-.045em] text-[#24231f]">{section === "overview" ? "TheLook at a glance." : current.label}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#7e7970]">Server-authorized data, cost guardrails, operational health and attributable actions.</p></div><button onClick={() => void load()} className="flex items-center gap-2 self-start rounded-full bg-[#292822] px-3 py-2 text-[10px] font-bold text-white"><Icon name="pulse" className="h-3.5 w-3.5" /> Refresh live data</button></div>{error && <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><Icon name="warning" /><span className="flex-1">Refresh failed: {error.message}. Showing the last successful snapshot.</span></div>}{snapshot.warnings.map((warning) => <div key={warning} className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><Icon name="warning" /><span className="flex-1">{warning}</span></div>)}{content}</div>
    </main>
  </div>{notice && <div role="status" className="fixed bottom-5 left-1/2 z-[110] -translate-x-1/2 rounded-full bg-[#292822] px-5 py-3 text-xs font-semibold text-white shadow-2xl">{notice}</div>}{confirmAction && <ConfirmDialog action={confirmAction} busy={mutating} onClose={() => setConfirmAction(null)} onConfirm={applyConfirmed} />}</div>;
}
