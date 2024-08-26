"use client";
import * as d3 from "d3";
import { useEffect } from "react";
import useSWRSubscription from "swr/subscription";

const marginTop = 30;
const marginBottom = 70;
const marginLeft = 70;
const marginRight = 25;
const oneMillion = 350;

export default function BarChart({
  data,
}: {
  data: { name: string; speed: string }[];
}) {
  const width = 450;
  const height = 450;
  const chartBottomY = height - marginBottom;

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.name))
    .range([marginLeft, width - marginRight])
    .padding(0.05);

  const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);

  // Create the vertical scale and its axis generator.
  const yScale = d3
    .scaleLinear()
    .domain([0, 250])
    .range([chartBottomY, marginTop]);

  const yAxis = d3.axisLeft(yScale);

  useEffect(() => {
    d3.select(".x-axis")
      .call(xAxis)
      .selectAll("text")
      .attr("font-size", "14px")
      // Rotate the labels to make them easier to read.
      .attr("transform", "rotate(-45)")
      .attr("text-anchor", "end");
    d3.select(".y-axis")
      .call(yAxis)
      .selectAll("text")
      .attr("font-size", "14px");
  }, [xAxis, yAxis]);

  return (
    <>
      <div className="h-full w-full flex-col ">
        {data[0].speed} kph
        <svg
          width={width}
          height={height}
          className="viz"
          viewBox={`0 0 ${width} ${height}`}
        >
          <g className="bars">
            {data.map((d) => (
              <rect
                key={d.name}
                x={xScale(String(d.speed))}
                y={yScale(d.speed)}
                height={chartBottomY - yScale(d.speed)}
                width={xScale.bandwidth()}
                fill="#6baed6"
              />
            ))}
          </g>
          <g className="x-axis" transform={`translate(0,${chartBottomY})`}></g>
          <g className="y-axis" transform={`translate(${marginLeft},0)`}></g>
        </svg>
      </div>
    </>
  );
}
