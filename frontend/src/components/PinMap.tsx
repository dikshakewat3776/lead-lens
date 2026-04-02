import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import type { GeoPin, PincodeMetadata } from "../types";

const INDIA_CENTER: LatLngExpression = [22.5, 79.0];
// Rough India bounding box (lat/lng) to keep the map focused.
const INDIA_BOUNDS: LatLngBoundsExpression = [
  [6.0, 68.0],
  [37.0, 97.4],
];

function heatColor(count: number, max: number): string {
  if (max <= 0) return "#2563eb";
  const t = Math.min(1, count / max);
  const h = 210 - t * 110;
  const l = 42 + t * 18;
  return `hsl(${h} 85% ${l}%)`;
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 9 });
  }, [map, bounds]);
  return null;
}

type Props = {
  geo: GeoPin[];
  metaByPin: Map<string, PincodeMetadata>;
  selected: string | null;
  onSelect: (pincode: string) => void;
};

export function PinMap({ geo, metaByPin, selected, onSelect }: Props) {
  const maxCount = useMemo(() => {
    let m = 0;
    metaByPin.forEach((v) => {
      if (v.lead_count > m) m = v.lead_count;
    });
    return m;
  }, [metaByPin]);

  // Fit the view to the provided pincode centroids.
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    if (!geo.length) return INDIA_BOUNDS;

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    for (const p of geo) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }

    // If we have very few points, add some padding by expanding the bounds a bit.
    const latPad = Math.max(0.8, (maxLat - minLat) * 0.25);
    const lngPad = Math.max(0.8, (maxLng - minLng) * 0.25);

    return [
      [minLat - latPad, minLng - lngPad],
      [maxLat + latPad, maxLng + lngPad],
    ];
  }, [geo]);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={6}
      minZoom={4}
      maxZoom={12}
      style={{ height: "100%", width: "100%", borderRadius: 12 }}
      scrollWheelZoom
      maxBounds={INDIA_BOUNDS}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds bounds={bounds} />
      {geo.map((g) => {
        const meta = metaByPin.get(g.pincode);
        const count = meta?.lead_count ?? 0;
        const r = 6 + Math.sqrt(count) * 1.1;
        const active = selected === g.pincode;
        return (
          <CircleMarker
            key={g.pincode}
            center={[g.lat, g.lng]}
            radius={Math.min(48, Math.max(8, r))}
            pathOptions={{
              color: active ? "#fbbf24" : "#0ea5e9",
              weight: active ? 3 : 1,
              fillColor: heatColor(count, maxCount || 1),
              fillOpacity: 0.82,
            }}
            eventHandlers={{
              click: () => onSelect(g.pincode),
            }}
          >
            <Tooltip direction="top" sticky opacity={1}>
              <div style={{ minWidth: 220, fontSize: 13 }}>
                <strong>
                  {g.pincode} — {g.label}
                </strong>
                {meta ? (
                  <>
                    <div style={{ marginTop: 6, color: "#94a3b8" }}>
                      Leads: <b style={{ color: "#e2e8f0" }}>{meta.lead_count}</b>
                    </div>
                    <div>
                      Avg loan: ₹{meta.avg_loan_amount?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                    </div>
                    <div>
                      Avg income / mo: ₹
                      {meta.avg_monthly_income?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                    </div>
                    <div>Top product: {meta.most_common_product_type?.replace(/_/g, " ") ?? "—"}</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>Click for table &amp; cross-sell</div>
                  </>
                ) : (
                  <div style={{ marginTop: 6 }}>No leads in demo dataset</div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
