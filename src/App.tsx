import { useState } from "react";
import { greet } from "./lib/tauri";

function App() {
  const [greeting, setGreeting] = useState("");
  const [name, setName] = useState("");

  async function handleGreet() {
    const response = await greet(name);
    setGreeting(response);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          IPTV Plex Integration
        </h1>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleGreet}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Greet
          </button>
        </div>
        {greeting && (
          <p className="text-green-600 font-medium">{greeting}</p>
        )}
      </div>
    </div>
  );
}

export default App;
