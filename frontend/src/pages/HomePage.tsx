function HomePage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mt-12 mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Trouve ta terrasse au soleil
        </h2>
        <p className="text-gray-500">
          Paris intra-muros — ensoleillement + météo en temps réel
        </p>
      </div>
      <div className="bg-white rounded-xl shadow p-4">
        <input
          type="text"
          placeholder="Nom d'un bar, restaurant ou adresse..."
          className="w-full p-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button className="mt-3 w-full bg-amber-500 text-white py-3 rounded-lg font-medium hover:bg-amber-600 transition">
          Autour de moi
        </button>
      </div>
    </div>
  );
}

export default HomePage;
