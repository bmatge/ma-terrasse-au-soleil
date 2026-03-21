import { useState, useEffect, useCallback } from "react";

export interface FavTerrasse {
  id: number;
  nom: string;
  adresse: string | null;
}

function loadFavorites(): FavTerrasse[] {
  try {
    return JSON.parse(localStorage.getItem("fav-terrasses") || "[]");
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavTerrasse[]>(loadFavorites);

  useEffect(() => {
    localStorage.setItem("fav-terrasses", JSON.stringify(favorites));
  }, [favorites]);

  const toggleFav = useCallback((terrasse: { id: number; nom: string; adresse: string | null }) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === terrasse.id);
      if (exists) return prev.filter((f) => f.id !== terrasse.id);
      return [...prev, { id: terrasse.id, nom: terrasse.nom, adresse: terrasse.adresse }];
    });
  }, []);

  const isFav = useCallback((id: number) => favorites.some((f) => f.id === id), [favorites]);

  return { favorites, toggleFav, isFav };
}
