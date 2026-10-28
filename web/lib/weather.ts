/**
 * Open-Meteo weather helpers. No API key required.
 * Geocoding: https://geocoding-api.open-meteo.com
 * Forecast:  https://api.open-meteo.com
 * Forecast range: up to 16 days from today.
 */

export const FORECAST_DAYS = 16;

export type GeoResult = { name: string; lat: number; lon: number; country: string };
export type DayForecast = {
  date: string;
  tempMin: number;
  tempMax: number;
  tempCurrent?: number;
  condition: string;
  weatherCode: number;
};

// WMO weather code → human-readable condition
const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Heavy showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

export async function geocode(location: string): Promise<GeoResult | null> {
  const cleaned = location.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  const queries = parts.length > 1 ? [parts[0]!, cleaned] : [cleaned];
  const countryHint = parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : null;

  for (const query of queries) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) continue;
    const data = await res.json() as {
      results?: Array<{ name: string; latitude: number; longitude: number; country?: string; country_code?: string }>;
    };
    const results = data.results ?? [];
    if (!results.length) continue;
    const matched = countryHint
      ? results.find(
          (r) =>
            r.country?.toLowerCase().includes(countryHint) ||
            r.country_code?.toLowerCase() === countryHint,
        ) ?? results[0]!
      : results[0]!;
    return {
      name: matched.name,
      lat: matched.latitude,
      lon: matched.longitude,
      country: matched.country ?? "",
    };
  }
  return null;
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json() as { city?: string; locality?: string; principalSubdivision?: string; countryName?: string };
      const city = data.city || data.locality || data.principalSubdivision;
      if (city && data.countryName) return `${city}, ${data.countryName}`;
      if (city) return city;
    }
  } catch {
    // fallback below
  }
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}

export async function forecast(lat: number, lon: number, date: string): Promise<DayForecast | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${date}&end_date=${date}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json() as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
    };
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weathercode: number[];
    };
  };
  const d = data.daily;
  if (!d?.time?.length) return null;
  const code = data.current?.weather_code ?? d.weathercode[0] ?? 0;
  return {
    date: d.time[0]!,
    tempMin: Math.round(d.temperature_2m_min[0]!),
    tempMax: Math.round(d.temperature_2m_max[0]!),
    tempCurrent: typeof data.current?.temperature_2m === "number" ? Math.round(data.current.temperature_2m) : undefined,
    condition: WMO[code] ?? "Clear sky",
    weatherCode: code,
  };
}
