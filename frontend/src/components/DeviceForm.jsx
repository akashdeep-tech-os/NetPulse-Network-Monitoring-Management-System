import { useState } from "react";

const DeviceForm = ({ onAdd }) => {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && ip.trim()) {
      onAdd({ name: name.trim(), ip: ip.trim() });
      setName("");
      setIp("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Device Name"
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
      />
      <input
        type="text"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        placeholder="IP Address"
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
      >
        Add Device
      </button>
    </form>
  );
};

export default DeviceForm;
