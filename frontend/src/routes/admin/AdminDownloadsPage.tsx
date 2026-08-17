import { useState, useEffect } from "react";
import {
  useAdminDownloads,
  useCancelDownload,
} from "../../hooks/useAdminQueries";
import { useCreateDownload } from "../../hooks/useCreateDownload";
import { useTaskProgress } from "../../hooks/useTaskProgress";
import type { DownloadStatus } from "../../types/admin";

const TABS = ["Queue", "History", "Failed"] as const;

const STATUS_MAP: Record<string, string[]> = {
  Queue: ["queued", "downloading"],
  History: ["completed"],
  Failed: ["failed"],
};

const STATUS_STYLES: Record<string, string> = {
  completed: "text-emerald-400 bg-emerald-400/10",
  downloading: "text-blue-400 bg-blue-400/10",
  queued: "text-yellow-400 bg-yellow-400/10",
  failed: "text-red-400 bg-red-400/10",
  cancelled: "text-[#666] bg-white/5",
};

interface Task {
  id: string;
  url: string;
  format: string;
  quality: string;
  status: string;
  progress: number | null;
  retryCount: number;
  createdAt: string;
  mediaTitle: string | null;
  username: string | null;
}

interface LiveProgress {
  status: string;
  progress: number | null;
  title?: string;
}

function CircularProgress({ percent }: { percent: number }) {
  const size = 36;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={2}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#60a5fa"
        strokeWidth={2}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{
          fontSize: 9,
          fill: "white",
          transform: "rotate(90deg)",
          transformOrigin: "50% 50%",
        }}
      >
        {percent}%
      </text>
    </svg>
  );
}

function TaskRow({
  task,
  onCancel,
  cancelPending,
}: {
  task: Task;
  onCancel: (id: string) => void;
  cancelPending: boolean;
}) {
  const live = useTaskProgress(
    task.status === "downloading" || task.status === "queued" ? task.id : null,
  );
  const status = live?.status ?? task.status;
  const progress = live?.progress ?? task.progress ?? 0;

  return (
    <tr className="group border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
      <td className="py-4 px-2 max-w-[220px]">
        <p className="text-white text-sm font-medium truncate">
          {live?.title ?? task.mediaTitle ?? "Unknown"}
        </p>
        <p className="text-[#555] text-xs truncate mt-0.5">{task.url}</p>
      </td>
      <td className="py-4 px-2 text-[#888] text-sm">{task.username ?? "—"}</td>
      <td className="py-4 px-2">
        <span className="text-xs font-mono bg-white/[0.06] px-2 py-0.5 rounded text-[#aaa]">
          {task.format} · {task.quality}
        </span>
      </td>
      <td className="py-4 px-2">
        {status === "downloading" ? (
          <div className="flex items-center gap-2">
            <CircularProgress
              percent={typeof progress === "number" ? progress : 0}
            />
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[status]}`}
            >
              {status}
            </span>
          </div>
        ) : (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[status] ?? ""}`}
          >
            {status}
          </span>
        )}
      </td>
      <td className="py-4 px-2 text-[#888] text-sm">{task.retryCount ?? 0}</td>
      <td className="py-4 px-2 text-[#888] text-xs whitespace-nowrap">
        {new Date(task.createdAt).toLocaleString()}
      </td>
      <td className="py-4 px-2 text-right">
        {["queued", "downloading"].includes(status) && (
          <button
            onClick={() => onCancel(task.id)}
            disabled={cancelPending}
            className="text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">
              cancel
            </span>
          </button>
        )}
      </td>
    </tr>
  );
}

function AddDownloadBar({ onQueued }: { onQueued: () => void }) {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("mp3");
  const [quality, setQuality] = useState("192k");
  const [error, setError] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const createDownload = useCreateDownload();
  const liveProgress = useTaskProgress(activeTaskId);

  useEffect(() => {
    if (!liveProgress) return;
    if (
      liveProgress.status === "completed" ||
      liveProgress.status === "failed"
    ) {
      setTimeout(() => setActiveTaskId(null), 2000);
    }
  }, [liveProgress?.status]);

  async function handleSubmit() {
    if (!url.trim()) return;
    setError("");
    setActiveTaskId(null);
    try {
      const res = await createDownload.mutateAsync({
        url: url.trim(),
        format,
        quality,
      });
      if (res.type === "track" && res.taskId) {
        setActiveTaskId(res.taskId);
      }
      setUrl("");
      onQueued();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to queue download");
    }
  }

  const isDownloading = liveProgress?.status === "downloading";
  const percent =
    typeof liveProgress?.progress === "number" ? liveProgress.progress : 0;

  return (
    <div className="px-8 py-4 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
      <div className="flex items-center gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Paste YouTube / SoundCloud URL..."
          className="flex-1 bg-[#111] border border-white/[0.08] focus:border-white/20 text-white text-sm px-4 py-2 rounded-lg outline-none placeholder:text-[#444] transition-colors"
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="bg-[#111] border border-white/[0.08] text-white text-sm px-3 py-2 rounded-lg outline-none"
        >
          {["mp3", "m4a", "opus", "flac"].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="bg-[#111] border border-white/[0.08] text-white text-sm px-3 py-2 rounded-lg outline-none"
        >
          {["128k", "192k", "256k", "320k"].map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <button
          onClick={handleSubmit}
          disabled={createDownload.isPending || !url.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-40 transition-all"
        >
          {createDownload.isPending ? (
            <span className="material-symbols-outlined text-[18px] animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-[18px]">add</span>
          )}
          Queue
        </button>
      </div>

      {/* Inline progress tracker after queuing */}
      {activeTaskId && liveProgress && (
        <div className="flex items-center gap-3 mt-3">
          <CircularProgress percent={percent} />
          <div className="flex flex-col">
            <span className="text-white text-xs font-medium truncate max-w-[300px]">
              {liveProgress.title ?? "Processing..."}
            </span>
            <span
              className={`text-xs mt-0.5 ${
                liveProgress.status === "completed"
                  ? "text-emerald-400"
                  : liveProgress.status === "failed"
                    ? "text-red-400"
                    : liveProgress.status === "queued"
                      ? "text-yellow-400"
                      : "text-blue-400"
              }`}
            >
              {liveProgress.status}
              {isDownloading ? ` · ${percent}%` : ""}
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}

export default function AdminDownloadsPage() {
  const [activeTab, setActiveTab] = useState("Queue");
  const [limit, setLimit] = useState(25);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [pageIndex, setPageIndex] = useState(0);

  const status = STATUS_MAP[activeTab];

  const { data, isLoading, isError, refetch } = useAdminDownloads({
    status: status.length === 1 ? status[0] : undefined,
    cursor,
    limit,
    sortOrder: "DESC",
  });

  console.log('data', data)

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setCursor(undefined);
    setCursorHistory([undefined]);
    setPageIndex(0);
  }

  function goNext() {
    if (!pagination?.nextCursor) return;
    setCursorHistory((h) => [...h, pagination.nextCursor!]);
    setPageIndex((i) => i + 1);
    setCursor(pagination.nextCursor);
  }

  function goPrev() {
    if (pageIndex === 0) return;
    const newIndex = pageIndex - 1;
    setPageIndex(newIndex);
    setCursor(cursorHistory[newIndex]);
  }

  const cancelDownload = useCancelDownload();

  const tasks = data?.tasks ?? [];
  const pagination = data?.pagination;

  const filtered =
    status.length > 1
      ? tasks.filter((t: any) => status.includes(t.status))
      : tasks;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-white text-white" : "border-transparent text-[#777] hover:text-white"}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-[#666]">
          <span>Per page</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setCursor(undefined);
              setCursorHistory([undefined]);
              setPageIndex(0);
            }}
            className="bg-[#111] border border-white/[0.08] text-white text-sm px-2 py-1 rounded outline-none"
          >
            {[10, 25, 50, 100].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AddDownloadBar
        onQueued={() => {
          handleTabChange("Queue");
          setCursor(undefined);
          setCursorHistory([undefined]);
          setPageIndex(0);
          refetch();
        }}
      />

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{activeTab}</h1>
          {activeTab === "Failed" && (
            <p className="text-xs text-[#555]">
              Failed jobs are retried automatically up to 3 times via RabbitMQ
              DLQ
            </p>
          )}
        </div>

        {isError && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-6 p-3 bg-red-400/5 rounded-lg">
            <span className="material-symbols-outlined text-[18px]">error</span>
            Failed to load download tasks
          </div>
        )}

        {!isLoading && filtered.length === 0 && !isError && (
          <div className="flex flex-col items-center justify-center py-24 text-[#444]">
            <span className="material-symbols-outlined text-5xl mb-3">
              inbox
            </span>
            <p className="text-sm">No {activeTab.toLowerCase()} downloads</p>
          </div>
        )}

        {(isLoading || filtered.length > 0) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="text-xs text-[#555] uppercase tracking-wider border-b border-white/[0.06]">
                  {[
                    "Title / URL",
                    "User",
                    "Format",
                    "Status",
                    "Retries",
                    "Requested",
                    "",
                  ].map((h) => (
                    <th key={h} className="pb-3 px-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/[0.04]">
                        {[200, 80, 80, 70, 40, 100, 20].map((w, j) => (
                          <td key={j} className="py-4 px-2">
                            <div
                              className="h-3 bg-white/[0.06] rounded animate-pulse"
                              style={{ width: w }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.map((task: any) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onCancel={(id) => cancelDownload.mutate(id)}
                        cancelPending={cancelDownload.isPending}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {(pageIndex > 0 || pagination?.hasNextPage) && (
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={goPrev}
              disabled={pageIndex === 0}
              className="px-3 py-1.5 text-sm bg-white/[0.06] hover:bg-white/10 rounded-lg text-white disabled:opacity-30 transition-colors"
            >
              Prev
            </button>
            <span className="text-sm text-[#555]">
              Page {pageIndex + 1}
              {!pagination?.hasNextPage ? " · last page" : ""}
            </span>
            <button
              onClick={goNext}
              disabled={!pagination?.hasNextPage}
              className="px-3 py-1.5 text-sm bg-white/[0.06] hover:bg-white/10 rounded-lg text-white disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
