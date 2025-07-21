"use client";

import { Activity, ArrowDown, ArrowUp, Dot, Ellipsis } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const InsightsSection = () => {
  const [insights, setInsights] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const params = useParams();
  const sessionId = params.sessionId;
  const router = useRouter();

  const backendBaseUrl = "http://localhost:8000";

  // Function to fetch initial session data including chat history
  const fetchSessionData = async () => {
    setIsLoadingHistory(true); // Start loading indicator for history
    try {
      const response = await fetch(`${backendBaseUrl}/session/${sessionId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error fetching session data:", errorText);
        throw new Error(`Failed to load session data: ${response.status}`);
      }
      const data = await response.json();
      setInsights(data.categorized_insights);
      console.log("Fetched Session Data:", data);
    } catch (error) {
      console.error("Error fetching session data:", error);
    } finally {
      setIsLoadingHistory(false); // End loading indicator for history
    }
  };

  // useEffect to load session data when the component mounts or sessionId changes
  useEffect(() => {
    fetchSessionData();
  }, [sessionId]);

  const goToInsights = () => {
    router.push(`/insights/${sessionId}`);
  };

  const trendIcon = (trend) => {
    switch (trend) {
      case "up":
        return <ArrowUp color="#16A34A" />;
      case "down":
        return <ArrowDown color="#DC2626" />;
      case "stable":
        return <Activity color="#3B82F6" />;
      default:
        return <Dot />;
    }
  };

  return (
    <div className="h-screen w-1/3 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-xl space-y-5 fixed right-0 overflow-y-auto">
      <h2 className="text-4xl font-extrabold text-gray-900 pb-4 border-b-2 border-blue-200 tracking-tight">
        Key Insights
      </h2>

      {insights.length > 0 ? (
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div
              onClick={goToInsights}
              key={index}
              className="bg-white rounded-xl shadow-md p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer border border-gray-100 transform hover:-translate-y-1"
            >
              <div>
                <span>{trendIcon(insight.trend)}</span>
                <div className="">
                  <p className="font-semibold text-gray-800 text-lg mb-2">
                    {insight.label}
                  </p>
                  <span className="font-extrabold text-base mr-2 flex items-center text-shadow-gray-600">
                    {insight.value}
                  </span>
                </div>
              </div>
              <span className="text-md text-gray-500">{insight.context}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500 text-lg">
          <p>No insights available yet. Your data will generate them here!</p>
        </div>
      )}

      <div className="mt-6 pt-4 text-center text-gray-500 text-sm italic border-t border-gray-200">
        <p>Insights dynamically update based on your latest data.</p>
      </div>
    </div>
  );
};

export default InsightsSection;
