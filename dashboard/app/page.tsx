"use client";

import useSWR from "swr";
import { SessionInfo } from "@/lib/types";
import { useRouter } from "next/navigation";
import { fetcher } from "../lib/Fetch";

export default function HomePage() {
  const { data, error } = useSWR<SessionInfo[]>("/api/sessions", fetcher);
  const router = useRouter();
  let sessionId = "";

  if (error) {
    console.error("Error fetching sessions:", error.message);
  }

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">iRacing Telemetry Dashboard</h1>

      <p>Please select a session for analysis</p>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Session
          </label>
          <select
            value={sessionId}
            onChange={(e) =>
              router.push(
                "/" + e.target.value.replace("telemetry_", "") + "?lapId=1"
              )
            }
            className="w-full bg-gray-700 text-white p-2 rounded"
            disabled={data !== undefined && data.length === 0}
          >
            {data !== undefined && data.length > 0 ? (
              <>
                <option value="" disabled>
                  Select a session
                </option>
                {data.map((session) => (
                  <option key={session.bucket} value={session.bucket}>
                    {session.bucket.replace("telemetry_", "")}
                  </option>
                ))}
              </>
            ) : (
              <option>Loading sessions...</option>
            )}
          </select>
        </div>
      </div>
    </div>
  );
}
