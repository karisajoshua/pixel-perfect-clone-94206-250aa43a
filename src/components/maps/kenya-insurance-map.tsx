import { useEffect, useRef } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type CountyMetric = { countyName: string; value: number };

type Props = {
  values: CountyMetric[];
  onCountyClick?: (countyName: string) => void;
};

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const COUNTY_SOURCE =
  "https://wwfke-giscoe.wwfkenya.org/arcgis/rest/services/Basedata_Kenya/KenyaCountyBoundary/MapServer/0/query?where=1%3D1&outFields=county&returnGeometry=true&outSR=4326&f=geojson";

export function KenyaInsuranceMap({ values, onCountyClick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!el.current) return;
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
      map.addSource("kenya-counties", {
        type: "geojson",
        data: COUNTY_SOURCE,
        promoteId: "county",
      });
      map.addLayer({
        id: "county-fill",
        type: "fill",
        source: "kenya-counties",
        paint: {
          "fill-color": [
            "interpolate", ["linear"], ["coalesce", ["feature-state", "metric_value"], 0],
            0, "#f8fafc", 1, "#dbeafe", 100, "#93c5fd", 1000, "#3b82f6", 10000, "#1e3a8a",
          ],
          "fill-opacity": 0.72,
        },
      });
      map.addLayer({
        id: "county-border",
        type: "line",
        source: "kenya-counties",
        paint: { "line-color": "#334155", "line-width": 0.9 },
      });
      for (const item of values) {
        map.setFeatureState({ source: "kenya-counties", id: item.countyName }, { metric_value: item.value });
      }
      map.on("mouseenter", "county-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "county-fill", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "county-fill", (event) => {
        const name = String(event.features?.[0]?.properties?.county ?? "County");
        onCountyClick?.(name);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getSource("kenya-counties")) return;
    for (const item of values) {
      map.setFeatureState({ source: "kenya-counties", id: item.countyName }, { metric_value: item.value });
    }
  }, [values]);

  return <div ref={el} className="h-[62vh] min-h-[440px] w-full overflow-hidden rounded-lg" aria-label="Interactive insurance analytics map of Kenya" />;
}
