import { useState } from "react";
import { useDashboardStats } from "../../hooks/useAdminQueries";

const TABS = ["Overview", "Services", "Logs"];

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[#555]">
          {label}
        </span>
        <span
          className={`material-symbols-outlined text-[20px] ${accent ?? "text-[#444]"}`}
        >
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#555] mt-1">{sub}</p>}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
      <div className="h-3 bg-white/[0.06] rounded animate-pulse w-2/3 mb-4" />
      <div className="h-7 bg-white/[0.08] rounded animate-pulse w-1/2 mb-2" />
      <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-3/4" />
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1e6;
  return `${mb.toFixed(0)} MB`;
}

export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const { data, isLoading, isError } = useDashboardStats();

  const users = data?.users;
  const downloads = data?.downloads;
  const storage = data?.storage;
  const queue = data?.queue;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-6 px-8 border-b border-white/[0.06] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-white text-white" : "border-transparent text-[#777] hover:text-white"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {isError && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-6 p-3 bg-red-400/5 rounded-lg">
            <span className="material-symbols-outlined text-[18px]">error</span>
            Failed to load dashboard stats
          </div>
        )}

        {activeTab === "Overview" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">
              System Overview
            </h2>
            <p className="text-sm text-[#555] mb-6">
              Live snapshot of users, downloads, and storage.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <StatCardSkeleton key={i} />
                ))
              ) : (
                <>
                  <StatCard
                    icon="people"
                    label="Total users"
                    value={users?.total ?? "—"}
                    sub={`${users?.active_today ?? 0} active today`}
                    accent="text-blue-400"
                  />
                  <StatCard
                    icon="download"
                    label="Downloads today"
                    value={downloads?.today ?? "—"}
                    sub={`${downloads?.downloading ?? 0} in progress`}
                    accent="text-purple-400"
                  />
                  <StatCard
                    icon="task_alt"
                    label="Completed"
                    value={downloads?.completed ?? "—"}
                    sub="all time"
                    accent="text-emerald-400"
                  />
                  <StatCard
                    icon="storage"
                    label="Storage used"
                    value={formatBytes(storage?.totalSize)}
                    sub={`temp: ${formatBytes(storage?.tempSize)}`}
                    accent="text-yellow-400"
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <StatCardSkeleton key={i} />
                ))
              ) : (
                <>
                  <StatCard
                    icon="person_add"
                    label="New this week"
                    value={users?.new_this_week ?? "—"}
                  />
                  <StatCard
                    icon="pending"
                    label="Queued"
                    value={downloads?.queued ?? "—"}
                    sub="waiting in RabbitMQ"
                  />
                  <StatCard
                    icon="error"
                    label="Failed"
                    value={downloads?.failed ?? "—"}
                    sub="all time"
                    accent="text-red-400"
                  />
                  <StatCard
                    icon="cloud_upload"
                    label="Active queue"
                    value={queue?.active ?? "—"}
                    sub={`waiting: ${queue?.waiting ?? 0}`}
                  />
                  <StatCard
                    icon="circle"
                    label="Online now"
                    value={users?.online_now ?? "—"}
                    sub="last 5 minutes"
                    accent="text-emerald-400"
                  />
                  <StatCard
                    icon="people"
                    label="Active recently"
                    value={users?.active_recently ?? "—"}
                    sub="last 15 minutes"
                  />
                </>
              )}
            </div>

            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[#555] mb-4">
                User breakdown
              </p>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-3 bg-white/[0.06] rounded animate-pulse"
                      style={{ width: `${60 + i * 10}%` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-2.5 text-sm">
                  {[
                    ["Total users", users?.total],
                    ["Admins", users?.admins],
                    ["Regular users", users?.users],
                    ["Active", users?.active],
                    ["New this week", users?.new_this_week],
                    ["Active today", users?.active_today],
                  ].map(([k, v]) => (
                    <div
                      key={String(k)}
                      className="flex items-center justify-between border-b border-white/[0.04] pb-2"
                    >
                      <span className="text-[#555]">{k}</span>
                      <span className="text-white font-mono text-xs">
                        {v ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "Services" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Services</h2>
            <p className="text-sm text-[#555] mb-6">
              Service health is determined at startup. For real-time status,
              check each service's own health endpoint.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="text-xs text-[#555] uppercase tracking-wider border-b border-white/[0.06]">
                    {["Service", "Type", "Port", "Notes"].map((h) => (
                      <th key={h} className="pb-3 px-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      name: "Express API",
                      type: "HTTP server",
                      port: "3000",
                      note: "Main backend",
                    },
                    {
                      name: "Downloader Worker",
                      type: "AMQP consumer",
                      port: "—",
                      note: "Separate process",
                    },
                    {
                      name: "PostgreSQL",
                      type: "Database",
                      port: "5432",
                      note: "Primary store",
                    },
                    {
                      name: "Redis",
                      type: "Cache / Pub",
                      port: "6379",
                      note: "Progress events",
                    },
                    {
                      name: "RabbitMQ",
                      type: "Message queue",
                      port: "5672",
                      note: "Download jobs",
                    },
                    {
                      name: "MinIO",
                      type: "Object store",
                      port: "9000",
                      note: "Audio files",
                    },
                    {
                      name: "yt-dlp",
                      type: "CLI tool",
                      port: "—",
                      note: "Spawned per job",
                    },
                  ].map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-sm font-medium text-white">
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-sm text-[#888]">
                        {row.type}
                      </td>
                      <td className="py-3.5 px-3 text-sm font-mono text-[#888]">
                        {row.port}
                      </td>
                      <td className="py-3.5 px-3 text-sm text-[#555]">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "Logs" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Logs</h2>
            <p className="text-sm text-[#555]">
              Application logs are written to{" "}
              <code className="text-[#aaa] text-xs bg-white/5 px-1.5 py-0.5 rounded">
                ./logs/
              </code>{" "}
              on disk. Stream them in your terminal with:
            </p>
            <pre className="mt-4 bg-[#080808] border border-white/[0.06] rounded-xl p-4 text-xs text-[#aaa] font-mono overflow-x-auto">
              {`# Backend
tail -f backend/logs/combined.log

# Downloader
tail -f services/downloader/logs/combined.log`}
            </pre>
            <p className="mt-4 text-xs text-[#555]">
              A live log viewer via WebSocket/SSE is planned for a future
              release.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
