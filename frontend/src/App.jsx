import AppRoutes from "./routes/AppRoutes";
import { useTheme } from "./routes/ThemeContext.jsx";

function App() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-slate-900" : "bg-slate-100"}`}>
      <AppRoutes />
    </div>
  );
}

export default App;
