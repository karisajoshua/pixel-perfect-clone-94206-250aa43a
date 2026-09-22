import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type CountyMetric = { countyCode: string; value: number };

type Props = {
  geojson: GeoJSON.FeatureCollection;
  values: CountyMetric[];
  onCountyClick?: (countyCode: string, countyName: string) => void;
};

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function KenyaInsuranceMap({ geojson, values, onCountyClick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const metric = new Map(values.map((x) => [x.countyCode, x.value]));
    const data: GeoJSON.FeatureCollection = {
      ...geojson,
      features: geojson.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          metric_value: metric.get(String(f.properties?.county_code ?? "")) ?? 0,
        },
      })),
    };

    const map = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [37.9, 0.2],
      zoom: 5.1,
      minZoom: 4.5,
      maxZoom: 12,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("kenya-counties", { type: "geojson", data });
      map.addLayer({
        id: "county-fill",
        type: "fill",
        source: "kenya-counties",
        paint: {
          "fill-color": [
            "interpolate", ["linear"], ["get", "metric_value"],
            0, "#f8fafc", 1, "#dbeafe", 100, "#93c5fd", 1000, "#3b82f6", 10000, "#1e3a8a",
          ],
          "fill-opacity": 0.72,
        },
      });
      map.addLayer({
        id: "county-border",
        type: "line",
        source: "kenya-counties",
        paint: { "line-color": "#334155", "line-width": 0.8 },
      });
      map.on("mouseenter", "county-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "county-fill", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "county-fill", (event) => {
        const feature = event.features?.[0];
        const code = String(feature?.properties?.county_code ?? "");
        const name = String(feature?.properties?.county_name ?? feature?.properties?.name ?? "County");
        if (code) onCountyClick?.(code, name);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("kenya-counties") as GeoJSONSource | undefined;
    if (!source) return;
    const metric = new Map(values.map((x) => [x.countyCode, x.value]));
    source.setData({
      ...geojson,
      features: geojson.features.map((f) => ({
        ...f,
        properties: { ...f.properties, metric_value: metric.get(String(f.properties?.county_code ?? "")) ?? 0 },
      })),
    });
  }, [values, geojson]);

  return <div ref={el} className="h-[62vh] min-h-[440px] w-full overflow-hidden rounded-lg" aria-label="Interactive insurance analytics map of Kenya" />;
}
