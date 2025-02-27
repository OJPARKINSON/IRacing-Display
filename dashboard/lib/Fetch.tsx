// import { SessionInfo } from "@/app/page";
// import { SetStateAction } from "react";
// import useSWR from "swr";

// const fetcher = (url: string) => fetch(url).then((res) => res.json());

// const FetchSessions = async ({
//   setError,
// }: {
//   setError: (value: React.SetStateAction<string | null>) => void;
// }) => {
//   const { data, error } = useSWR<SessionInfo[]>("/api/sessions", fetcher);

//   if (error) {
//     console.error("Error fetching sessions:", error.message);
//     setError(error.message);
//   }

//   if (data && data.length > 0) {
//     setAvailableSessions(data);

//     // Only set default session if not already set from URL
//     if (!sessionId && data.length > 0) {
//       setSessionId(data[0].bucket);
//     }
//   } else {
//     setError("No sessions available");
//   }
// };
