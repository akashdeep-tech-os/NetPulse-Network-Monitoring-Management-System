import { useState } from "react";

const EditModal = ({ device, field, onClose, onSave }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">
          {field === "name" ? "Edit Device Name" : "Edit IP Address"}
        </h3>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
