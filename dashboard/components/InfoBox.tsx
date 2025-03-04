import { TelemetryDataPoint } from "@/app/page";
import { useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  CartesianGrid,
  ReferenceDot,
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

// Updated TelemetryChart component with scrubbing support
export const TelemetryChart = ({
  selectedMetric,
  setSelectedMetric,
  availableMetrics,
  telemetryData,
  selectedIndex,
  onIndexChange,
}: {
  selectedMetric: string;
  setSelectedMetric: (metric: string) => void;
  availableMetrics: string[];
  telemetryData: TelemetryDataPoint[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}) => {
  // Memoize the data that we'll show on the chart for better performance
  const chartData = useMemo(() => {
    return telemetryData.map((point, index) => ({
      ...point,
      index, // Ensure index is included for reference
    }));
  }, [telemetryData]);

  // Handle clicking on chart
  const handleChartClick = useCallback(
    (data: any) => {
      if (data && data.activeTooltipIndex !== undefined) {
        onIndexChange(data.activeTooltipIndex);
      }
    },
    [onIndexChange]
  );

  // Handle moving the mouse over the chart
  const handleMouseMove = useCallback((e: any) => {
    if (e.isTooltipActive && e.activeTooltipIndex !== undefined) {
      // Optional: You could update on mousemove too, but it might be too sensitive
      // Uncomment the next line if you want position updates on hover
      // onIndexChange(e.activeTooltipIndex);
    }
  }, []);

  const getDataValue = (point: TelemetryDataPoint, key: string): number => {
    console.log("point", point);
    console.log("key", key);
    if (point !== undefined && key in point) {
      return (point as any)[key] as number;
    }
    return 0;
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Telemetry Data</h2>
        <div>
          <label className="text-sm mr-2">Select Metric:</label>
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
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            onClick={handleChartClick}
            onMouseMove={handleMouseMove}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionTime"
              label={{
                value: "Session Time (s)",
                position: "insideBottom",
                offset: -5,
                fill: "#fff",
              }}
              tick={{ fill: "#fff" }}
            />
            <YAxis tick={{ fill: "#fff" }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-gray-700 p-2 rounded shadow">
                      <p className="text-gray-300">
                        Time: {payload[0].payload.sessionTime.toFixed(2)}s
                      </p>
                      <p className="text-red-400">
                        {selectedMetric}: {payload[0].value}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey={selectedMetric}
              stroke="#ff6565"
              dot={false} // No dots for better performance with large datasets
              activeDot={{
                r: 6,
                fill: "#ff0000",
                onClick: (dotProps: any) => {
                  const index = (dotProps as any).index;
                  if (typeof index === "number") {
                    onIndexChange(index);
                  }
                },
              }}
            />
            {/* Current point indicator */}
            {selectedIndex !== null &&
              selectedIndex >= 0 &&
              selectedIndex < chartData.length && (
                <ReferenceDot
                  x={chartData[selectedIndex]?.sessionTime}
                  y={getDataValue(chartData[selectedIndex], selectedMetric)}
                  r={8}
                  fill="#00ffff"
                  stroke="#000"
                />
              )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Metric info boxes */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="bg-gray-700 p-2 rounded">
          <p className="text-sm text-gray-400">Lap</p>
          <p className="font-semibold">
            {telemetryData.length > 0 && selectedIndex !== null
              ? Math.floor(telemetryData[selectedIndex].LapDistPct)
              : "-"}
          </p>
        </div>
        <div className="bg-gray-700 p-2 rounded">
          <p className="text-sm text-gray-400">LapDistPct</p>
          <p className="font-semibold">
            {telemetryData.length > 0 && selectedIndex !== null
              ? telemetryData[selectedIndex].LapDistPct.toFixed(1)
              : "-"}
          </p>
        </div>
        <div className="bg-gray-700 p-2 rounded">
          <p className="text-sm text-gray-400">Speed</p>
          <p className="font-semibold">
            {telemetryData.length > 0 && selectedIndex !== null
              ? telemetryData[selectedIndex].Speed.toFixed(1)
              : "-"}
          </p>
        </div>
        <div className="bg-gray-700 p-2 rounded">
          <p className="text-sm text-gray-400">Throttle</p>
          <p className="font-semibold">
            {telemetryData.length > 0 && selectedIndex !== null
              ? telemetryData[selectedIndex].Throttle.toFixed(1)
              : "-"}
          </p>
        </div>
      </div>
    </div>
  );
};
