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
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json() as { results?: Array<{ name: string; latitude: number; longitude: number; country: string }> };
  const r = data.results?.[0];
  if (!r) return null;
  return { name: r.name, lat: r.latitude, lon: r.longitude, country: r.country };
}

export async function forecast(lat: number, lon: number, date: string): Promise<DayForecast | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${date}&end_date=${date}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json() as {
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weathercode: number[];
    };
  };
  const d = data.daily;
  if (!d?.time?.length) return null;
  const code = d.weathercode[0] ?? 0;
  return {
    date: d.time[0]!,
    tempMin: Math.round(d.temperature_2m_min[0]!),
    tempMax: Math.round(d.temperature_2m_max[0]!),
    condition: WMO[code] ?? "Unknown",
    weatherCode: code,
  };
}
