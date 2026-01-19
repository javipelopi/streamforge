import { useState } from "react";
import { greet } from "./lib/tauri";

function App() {
  const [greeting, setGreeting] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGreet() {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await greet(name);
      setGreeting(response);
    } catch (err) {
      setError(`Failed to greet: ${err instanceof Error ? err.message : String(err)}`);
      setGreeting("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          IPTV Plex Integration
        </h1>
        <div className="flex flex-col gap-2 mb-4">
          <label htmlFor="name-input" className="text-sm font-medium text-gray-700">
            Your Name
          </label>
          <div className="flex gap-2">
            <input
              id="name-input"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGreet()}
              disabled={isLoading}
              className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Enter your name for greeting"
            />
            <button
              onClick={handleGreet}
              disabled={isLoading || !name.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Get greeting message"
            >
              {isLoading ? "..." : "Greet"}
            </button>
          </div>
        </div>
        {error && (
          <p className="text-red-600 font-medium mb-2" role="alert">{error}</p>
        )}
        {greeting && (
          <p className="text-green-600 font-medium" role="status">{greeting}</p>
        )}
      </div>
    </div>
  );
}

export default App;
