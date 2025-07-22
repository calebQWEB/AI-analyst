"use client";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react"; // Import useRef
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
import { ArrowLeft, Download } from "lucide-react"; // Import Download icon

// Import html-to-image functions
import { toPng, toJpeg, toSvg } from "html-to-image";

const COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#ec4899",
];

const InsightDetailsPage = () => {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [allInsights, setAllInsights] = useState([]);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [chartType, setChartType] = useState("bar");

  const params = useParams();
  const sessionId = params.id;

  const backendBaseUrl = "http://localhost:8000";

  // Create a ref for the chart container
  const chartRef = useRef(null);

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
      setAllInsights(fetchedInsights);

      if (fetchedInsights.length > 0) {
        setSelectedInsight(fetchedInsights[0]);
      } else {
        setSelectedInsight(null);
      }
    } catch (error) {
      console.error("Error fetching session data:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [sessionId]);

  if (isLoadingHistory && !selectedInsight) {
    return (
      <p className="text-center text-gray-500 p-10">Loading insights...</p>
    );
  }

  if (!isLoadingHistory && allInsights.length === 0) {
    return (
      <p className="text-center text-gray-500 p-10">
        No insights found for this session.
      </p>
    );
  }

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

  // --- NEW: Chart Export Function ---
  const exportChart = async (format = "png") => {
    if (!chartRef.current) {
      console.error("Chart ref is not available for export.");
      return;
    }

    try {
      let dataUrl;
      const fileName = `${selectedInsight.label
        .replace(/\s+/g, "_")
        .toLowerCase()}_${chartType}_chart`;

      if (format === "png") {
        dataUrl = await toPng(chartRef.current, { backgroundColor: "#ffffff" }); // Ensure white background
      } else if (format === "jpeg") {
        dataUrl = await toJpeg(chartRef.current, {
          quality: 0.95,
          backgroundColor: "#ffffff",
        });
      } else if (format === "svg") {
        dataUrl = await toSvg(chartRef.current, { backgroundColor: "#ffffff" });
      } else {
        console.error("Unsupported export format:", format);
        return;
      }

      const link = document.createElement("a");
      link.download = `${fileName}.${format}`;
      link.href = dataUrl;
      document.body.appendChild(link); // Append to body to make it clickable
      link.click(); // Programmatically click the link to trigger download
      document.body.removeChild(link); // Clean up the link element
      console.log(`Chart exported as ${format}.`);
    } catch (error) {
      console.error("Error exporting chart:", error);
      alert("Failed to export chart. Please try again.");
    }
  };
  // --- END NEW: Chart Export Function ---

  const ChartComponent = () => {
    if (
      !selectedInsight ||
      !selectedInsight.data ||
      selectedInsight.data.length === 0
    ) {
      return (
        <p className="text-center text-gray-500">No data to display chart.</p>
      );
    }

    const chartData = selectedInsight.data;

    if (chartType === "bar") {
      return (
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#0ea5e9" radius={[5, 5, 0, 0]} />
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
            dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
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
            }
          >
            {chartData.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      );
    }
    return null;
  };

  return (
    <div className="max-w-full mx-auto py-12 px-6 space-y-8">
      <button
        onClick={() => window.history.back()}
        className="text-blue-600 flex items-center mb-4 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-1" /> Back to Chat
      </button>

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

          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-3">
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
            {/* NEW: Export Buttons */}
            <div className="relative flex items-center justify-center gap-3">
              {" "}
              {/* Use relative for dropdown positioning if needed */}
              <button
                onClick={() => exportChart("png")}
                className="px-4 py-2 rounded-md font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> PNG
              </button>
              {/* You can add more export options (JPEG, SVG) here if desired */}
              <button
                onClick={() => exportChart("jpeg")}
                className="ml-2 px-4 py-2 rounded-md font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> JPEG
              </button>
              <button
                onClick={() => exportChart("svg")}
                className="ml-2 px-4 py-2 rounded-md font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> SVG
              </button>
            </div>
            {/* END NEW: Export Buttons */}
          </div>

          <div ref={chartRef} className="w-full h-[450px] mt-8 p-2">
            {" "}
            {/* Attach ref here */}
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
