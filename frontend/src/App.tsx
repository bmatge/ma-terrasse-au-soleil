import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TimelinePage from "./pages/TimelinePage";
import NearbyPage from "./pages/NearbyPage";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-500 text-white p-4 shadow">
        <h1 className="text-xl font-bold">Terrasse au Soleil</h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/terrasse/:id" element={<TimelinePage />} />
          <Route path="/nearby" element={<NearbyPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
