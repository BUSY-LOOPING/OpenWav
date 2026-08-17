import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/";

export interface LiveProgress {
  taskId: string;
  status: string;
  progress: number | null;
  title?: string;
}

export function useTaskProgress(taskId: string | null) {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [progress, setProgress] = useState<LiveProgress | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const baseURL =
      import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
    const es = new EventSource(
      `${baseURL}/progress/${taskId}?token=${encodeURIComponent(accessToken)}`,
      { withCredentials: true },
    );

    es.onmessage = (e) => {
      const data: LiveProgress = JSON.parse(e.data);
      setProgress(data);
      if (data.status === "completed" || data.status === "failed") {
        es.close();
      }
    };

    es.onerror = () => es.close();

    return () => es.close();
  }, [taskId]);

  return progress;
}
