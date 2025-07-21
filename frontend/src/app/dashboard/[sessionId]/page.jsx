import History from "@/components/History";
import ChatInterface from "../_components/ChatInterface";
import InsightsSection from "../_components/InsightsSection";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex relative">
      <History />
      <ChatInterface />
      <InsightsSection />
    </div>
  );
}
