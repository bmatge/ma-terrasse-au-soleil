import { Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TimelinePage from "./pages/TimelinePage";
import NearbyPage from "./pages/NearbyPage";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-500 text-white p-4 shadow">
        <Link to="/" className="text-xl font-bold hover:opacity-90">
          Terrasse au Soleil
        </Link>
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
