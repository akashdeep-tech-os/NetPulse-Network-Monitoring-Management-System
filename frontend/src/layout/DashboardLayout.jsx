import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useTheme } from "../routes/ThemeContext.jsx";

const DashboardLayout = ({
  children,
  offlineCount = 0,
  pinging = false,
  canPing = true,
  searchQuery,
  onSearchChange,
  onPingAll,
}) => {
  const { theme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className={`flex h-screen overflow-hidden ${
      theme === "dark" ? "bg-slate-900" : "bg-slate-100"
    }`}>
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          offlineCount={offlineCount}
          pinging={pinging}
          canPing={canPing}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onPingAll={onPingAll}
          onMenuToggle={() => setIsMobileOpen(!isMobileOpen)}
        />

        <main className="px-3 md:px-4 py-3 flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
