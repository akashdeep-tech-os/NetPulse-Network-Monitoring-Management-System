import { useState } from "react";
import { useTheme } from "../routes/ThemeContext.jsx";

const EditModal = ({ device, field, onClose, onSave }) => {
  const { theme } = useTheme();
  const [value, setValue] = useState(
    device ? (field === "name" ? device.name : device.ip_address) : "",
  );

  const handleSave = () => {
    if (value.trim()) {
      onSave(device.id, field, value.trim());
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  };

  if (!device) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`rounded-2xl shadow-2xl p-6 w-full max-w-sm ${
        theme === "dark" ? "bg-slate-800" : "bg-white"
      }`}>
        <h3 className={`text-base font-semibold mb-4 ${
          theme === "dark" ? "text-white" : "text-gray-800"
        }`}>
          {field === "name" ? "Edit Device Name" : "Edit IP Address"}
        </h3>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            theme === "dark"
              ? "bg-slate-700 border-slate-600 text-white"
              : "border-gray-200 text-gray-800"
          }`}
        />
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-medium transition ${
              theme === "dark"
                ? "text-gray-300 bg-slate-700 hover:bg-slate-600"
                : "text-gray-700 bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
