import { NextRequest, NextResponse } from "next/server";
import { forecast, geocode, reverseGeocode } from "@/lib/weather";

export const runtime = "nodejs";

function inferSeasonFromTemp(tempMax: number, tempMin: number): "winter" | "spring" | "summer" | "autumn" {
  const avg = (tempMax + tempMin) / 2;
  if (avg <= 10) return "winter";
  if (avg >= 24) return "summer";
  if (avg >= 17) return "spring";
  return "autumn";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      lat?: number;
      lon?: number;
      location?: string;
      date?: string;
    };

    const today = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : new Date().toISOString().slice(0, 10);

    let lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
    let lon = typeof body.lon === "number" && Number.isFinite(body.lon) ? body.lon : null;
    let resolvedLocation = typeof body.location === "string" ? body.location.trim() : "";

    if ((lat === null || lon === null) && resolvedLocation) {
      const geo = await geocode(resolvedLocation);
      if (!geo) {
        return NextResponse.json({ error: `Could not find location "${resolvedLocation}".` }, { status: 404 });
      }
      lat = geo.lat;
      lon = geo.lon;
      resolvedLocation = geo.country ? `${geo.name}, ${geo.country}` : geo.name;
    }

    if (lat === null || lon === null) {
      return NextResponse.json({ error: "Coordinates or location name required." }, { status: 400 });
    }

    const [wx, label] = await Promise.all([
      forecast(lat, lon, today),
      resolvedLocation ? Promise.resolve(resolvedLocation) : reverseGeocode(lat, lon),
    ]);

    if (!wx) {
      return NextResponse.json({ error: "Weather forecast unavailable for this location." }, { status: 502 });
    }

    const season = inferSeasonFromTemp(wx.tempMax, wx.tempMin);
    const tempDisplay = typeof wx.tempCurrent === "number"
      ? `${wx.tempCurrent}°C (${wx.tempMin}–${wx.tempMax}°C)`
      : `${wx.tempMin}–${wx.tempMax}°C`;
    const summary = `${label} · ${tempDisplay}, ${wx.condition}`;

    return NextResponse.json({
      location: label,
      lat,
      lon,
      date: wx.date,
      tempMin: wx.tempMin,
      tempMax: wx.tempMax,
      tempCurrent: wx.tempCurrent,
      condition: wx.condition,
      weatherCode: wx.weatherCode,
      season,
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Weather lookup failed" },
      { status: 500 },
    );
  }
}

