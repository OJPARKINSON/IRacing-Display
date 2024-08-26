"use client";

import BarChart from "@/components/charts/barChart";
import useSWRSubscription from "swr/subscription";

export default function DashboardPage() {
  const { data, error } = useSWRSubscription(
    "ws://localhost:8080/ws",
    (key, { next }) => {
      const socket = new WebSocket(key);
      socket.addEventListener("message", (event) => next(null, event.data));
      return () => socket.close();
    }
  );

  const speed = [{ name: "test", speed: (50 * 3.6).toFixed(2) }];

  return (
    <>
      <BarChart data={speed} />
    </>
  );
}
