import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "../hooks/useDebounce";
import { searchTerrasses, geocode } from "../api/terrasses";
import type { TerrasseSearchResult, GeocodeResult } from "../api/types";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: terrasses, isFetching: fetchingTerrasses } = useQuery({
    queryKey: ["search-terrasses", debouncedQuery],
    queryFn: () => searchTerrasses(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: addresses, isFetching: fetchingAddresses } = useQuery({
    queryKey: ["geocode", debouncedQuery],
    queryFn: () => geocode(debouncedQuery),
    enabled: debouncedQuery.length >= 3,
  });

  const isSearching = fetchingTerrasses || fetchingAddresses;
  const hasResults =
    (terrasses && terrasses.length > 0) ||
    (addresses && addresses.length > 0);
  const showDropdown = open && debouncedQuery.length >= 2;

  function selectTerrasse(t: TerrasseSearchResult) {
    setOpen(false);
    setQuery(t.nom);
    navigate(`/terrasse/${t.id}`);
  }

  function selectAddress(a: GeocodeResult) {
    setOpen(false);
    setQuery(a.label);
    navigate(`/nearby?lat=${a.lat}&lon=${a.lon}`);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Nom d'un bar, restaurant ou adresse..."
        className="w-full p-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
      />

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isSearching && (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">
              Recherche...
            </div>
          )}

          {!isSearching && hasResults && (
            <div className="sm:grid sm:grid-cols-2 sm:divide-x sm:divide-gray-100">
              {/* Terrasses column */}
              <div className={`${terrasses && terrasses.length > 0 ? "" : "hidden sm:block"}`}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase bg-gray-50">
                  ☀️ Terrasses
                </div>
                {terrasses && terrasses.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    {terrasses.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => selectTerrasse(t)}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 cursor-pointer"
                      >
                        <div className="font-medium text-gray-800 text-sm">{t.nom}</div>
                        <div className="text-xs text-gray-500 truncate">{t.adresse}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-3 text-xs text-gray-300 text-center">
                    Aucun établissement
                  </div>
                )}
              </div>

              {/* Adresses column */}
              <div className={`${addresses && addresses.length > 0 ? "" : "hidden sm:block"} border-t sm:border-t-0`}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase bg-gray-50">
                  📍 Adresses
                </div>
                {addresses && addresses.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    {addresses.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => selectAddress(a)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 cursor-pointer"
                      >
                        <div className="text-sm text-gray-700">{a.label}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-3 text-xs text-gray-300 text-center">
                    Aucune adresse
                  </div>
                )}
              </div>
            </div>
          )}

          {!isSearching && !hasResults && (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">
              Aucun résultat pour &laquo; {debouncedQuery} &raquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
