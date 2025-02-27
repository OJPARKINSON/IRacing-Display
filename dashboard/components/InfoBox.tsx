import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Line,
} from "recharts";

interface InfoBoxProps {
  telemetryData: any[];
  lapId: string;
}

export const InfoBox = ({ telemetryData, lapId }: InfoBoxProps) => {
  return (
    <div className="mt-4 bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-2">Telemetry Details</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm text-gray-400">Lap</div>
          <div className="text-xl font-bold">{lapId}</div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm text-gray-400">Lap Time</div>
          <div className="text-xl font-bold">
            {telemetryData[telemetryData.length - 1].LapCurrentLapTime?.toFixed(
              2
            ) || "0.00"}
          </div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm text-gray-400">Position</div>
          <div className="text-xl font-bold">
            {telemetryData[telemetryData.length - 1].PlayerCarPosition || 0}
          </div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm text-gray-400">Fuel</div>
          <div className="text-xl font-bold">
            {telemetryData[telemetryData.length - 1].FuelLevel?.toFixed(1) || 0}{" "}
            L
          </div>
        </div>
      </div>
    </div>
  );
};

interface TelemetryChartProps {
  selectedMetric: string;
  setSelectedMetric: React.Dispatch<React.SetStateAction<string>>;
  availableMetrics: Array<string>;
  telemetryData: any[];
}

export const TelemetryChart = ({
  selectedMetric,
  setSelectedMetric,
  availableMetrics,
  telemetryData,
}: TelemetryChartProps) => {
  return (
    <div className="col-span-1 bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-2">Telemetry Data</h2>

      <div className="mb-4">
        <label className="mr-2">Select Metric:</label>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          className="bg-gray-700 text-white p-1 rounded"
        >
          {availableMetrics.map((metric) => (
            <option key={metric} value={metric}>
              {metric}
            </option>
          ))}
        </select>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={telemetryData}>
            <XAxis
              dataKey="sessionTime"
              stroke="#aaa"
              tickFormatter={(value) => value.toFixed(1)}
              label={{
                value: "Session Time (s)",
                position: "insideBottomRight",
                offset: -5,
              }}
            />
            <YAxis stroke="#aaa" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#2d3748",
                color: "white",
                border: "none",
              }}
              formatter={(value) => [value, selectedMetric]}
              labelFormatter={(label) => `Time: ${label.toFixed(2)}s`}
            />
            <Line
              type="monotone"
              dataKey={selectedMetric}
              stroke="#f56565"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Key Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {availableMetrics.slice(0, 4).map((metric) => (
          <div key={metric} className="bg-gray-700 p-2 rounded">
            <div className="text-sm text-gray-400">{metric}</div>
            <div className="text-lg font-bold">
              {telemetryData.length > 0
                ? telemetryData[telemetryData.length - 1][metric]?.toFixed(1)
                : 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
