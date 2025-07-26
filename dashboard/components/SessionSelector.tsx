"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Session {
	session_id: string;
	last_updated: Date;
}

interface SessionSelectorProps {
	sessions: Session[];
}

export default function SessionSelector({ sessions }: SessionSelectorProps) {
	const router = useRouter();
	const [selectedSession, setSelectedSession] = useState<string>("");

	const handleSessionSelect = (sessionId: string) => {
		if (sessionId) {
			router.push(`/${sessionId}?lapId=1`);
		}
	};

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(date));
	};

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label
					htmlFor="selectSession"
					className="block text-sm font-medium text-gray-300 mb-1"
				>
					Select Session
				</label>
				<select
					name="selectSession"
					value={selectedSession}
					onChange={(e) => {
						setSelectedSession(e.target.value);
						handleSessionSelect(e.target.value);
					}}
					className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
				>
					<option value="" disabled>
						Choose a session...
					</option>
					{sessions.map((session) => (
						<option key={session.session_id} value={session.session_id}>
							{session.session_id} - {formatDate(session.last_updated)}
						</option>
					))}
				</select>
			</div>

			<div>
				<label
					htmlFor="QAB"
					className="block text-sm font-medium text-gray-300 mb-1"
				>
					Quick Access
				</label>
				<div className="space-y-2">
					{sessions.slice(0, 3).map((session) => (
						<button
							name="QAB"
							type="button"
							key={session.session_id}
							onClick={() => handleSessionSelect(session.session_id)}
							className="w-full text-left bg-gray-700 hover:bg-gray-600 text-white p-2 rounded border border-gray-600 transition-colors"
						>
							<div className="font-medium">{session.session_id}</div>
							<div className="text-sm text-gray-400">
								{formatDate(session.last_updated)}
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
