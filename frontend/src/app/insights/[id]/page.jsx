"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft } from "lucide-react"; // Assuming you have this icon

const COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#ec4899",
]; // More colors for variety

const InsightDetailsPage = () => {
  // Renamed 'page' to be more descriptive
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [allInsights, setAllInsights] = useState([]); // Stores the array of all insights
  const [selectedInsight, setSelectedInsight] = useState(null); // Stores the currently displayed insight
  const [chartType, setChartType] = useState("bar"); // Default to bar chart

  const params = useParams();
  const sessionId = params.id;

  const backendBaseUrl = "http://localhost:8000";

  // Function to fetch initial session data including chat history and insights
  const fetchSessionData = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${backendBaseUrl}/session/${sessionId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error fetching session data:", errorText);
        throw new Error(`Failed to load session data: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched Session Data:", data);

      const fetchedInsights = data.categorized_insights || [];
      setAllInsights(fetchedInsights); // Store the array of all insights

      // Automatically select the first insight to display its chart
      if (fetchedInsights.length > 0) {
        setSelectedInsight(fetchedInsights[0]);
      } else {
        setSelectedInsight(null); // No insights to display
      }
    } catch (error) {
      console.error("Error fetching session data:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [sessionId]); // Re-fetch if sessionId changes

  // Display loading state for the page
  if (isLoadingHistory && !selectedInsight) {
    // Show loading only if no insight is loaded yet
    return (
      <p className="text-center text-gray-500 p-10">Loading insights...</p>
    );
  }

  // Display message if no insights are found for the session
  if (!isLoadingHistory && allInsights.length === 0) {
    return (
      <p className="text-center text-gray-500 p-10">
        No insights found for this session.
      </p>
    );
  }

  // If insights are loading or no insight is selected yet, don't render chart
  if (
    !selectedInsight ||
    !selectedInsight.data ||
    selectedInsight.data.length === 0
  ) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
        <button
          onClick={() => window.history.back()}
          className="text-blue-600 flex items-center mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-1" /> Back to Chat
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Insight Details</h1>
        <p className="text-center text-gray-500">
          {isLoadingHistory
            ? "Loading insight data..."
            : "No chart data available for this insight."}
        </p>
      </div>
    );
  }

  // Chart rendering logic using the selectedInsight's data
  const ChartComponent = () => {
    // Ensure selectedInsight and its data exist before rendering
    if (
      !selectedInsight ||
      !selectedInsight.data ||
      selectedInsight.data.length === 0
    ) {
      return (
        <p className="text-center text-gray-500">No data to display chart.</p>
      );
    }

    const chartData = selectedInsight.data; // Use the data from the selected insight

    if (chartType === "bar") {
      return (
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#0ea5e9" radius={[5, 5, 0, 0]} />{" "}
          {/* Added rounded tops */}
        </BarChart>
      );
    } else if (chartType === "line") {
      return (
        <LineChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} // Added dots for clarity
            activeDot={{
              r: 6,
              fill: "#10b981",
              stroke: "#fff",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      );
    } else if (chartType === "pie") {
      return (
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            fill="#8884d8"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            } // Show name and percentage
          >
            {chartData.map(
              (
                entry,
                i // Use chartData here
              ) => (
                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
              )
            )}
          </Pie>
          <Tooltip />
        </PieChart>
      );
    }
    return null; // Should not happen if chartType is one of the above
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <button
        onClick={() => window.history.back()}
        className="text-blue-600 flex items-center mb-4 hover:text-blue-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5 mr-1" /> Back to Chat
      </button>

      {/* Insight Selector - if you have multiple insights */}
      {allInsights.length > 1 && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            Select an Insight:
          </h3>
          <div className="flex flex-wrap gap-3">
            {allInsights.map((insight, index) => (
              <button
                key={index}
                onClick={() => setSelectedInsight(insight)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${
                    selectedInsight?.label === insight.label
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }
                `}
              >
                {insight.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display selected insight details */}
      {selectedInsight && (
        <>
          <h1 className="text-4xl font-bold text-gray-800">
            {selectedInsight.label}
          </h1>
          <p className="text-xl text-gray-600">
            {selectedInsight.value} ({selectedInsight.trend})
          </p>
          <p className="text-sm text-gray-400 italic">
            {selectedInsight.context}
          </p>

          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setChartType("bar")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                chartType === "bar"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                chartType === "line"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                chartType === "pie"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Pie
            </button>
          </div>

          <div className="w-full h-[300px] mt-8 bg-gray-50 rounded-lg shadow-md p-2">
            {" "}
            {/* Added background for chart area */}
            <ResponsiveContainer width="100%" height="100%">
              {ChartComponent()}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default InsightDetailsPage;
