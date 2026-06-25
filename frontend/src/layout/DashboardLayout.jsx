import Sidebar from "./Sidebar";
import Header from "./Header";

const DashboardLayout = ({
  children,
  offlineCount = 0,
  name,
  ip,
  onNameChange,
  onIpChange,
  onAdd,
  searchQuery,
  onSearchChange,
  onImport,
  onExport,
  onPingAll,
}) => {
  return (
    <div className="flex bg-slate-100 h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          offlineCount={offlineCount}
          name={name}
          ip={ip}
          onNameChange={onNameChange}
          onIpChange={onIpChange}
          onAdd={onAdd}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onImport={onImport}
          onExport={onExport}
          onPingAll={onPingAll}
        />

        <main className="px-4 py-3 flex-1 overflow-hidden flex flex-col">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
