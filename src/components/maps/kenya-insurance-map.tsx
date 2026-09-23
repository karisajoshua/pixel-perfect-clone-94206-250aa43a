import { useEffect, useRef } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { KENYA_BOUNDARY_SOURCES, boundaryNameProperty, normalizeBoundaryName, type GeographicLevel } from "@/lib/geographic/boundaries";

export type CountyMetric = { countyName: string; value: number };
export type GeographicMetric = { name: string; value: number };

const colorExpression = (values: GeographicMetric[], property: string): any => {
  const positive = values.map((v) => Number(v.value || 0)).filter((v) => v > 0);
  if (!positive.length) return "#f8fafc";
  const max = Math.max(...positive);
  const match: any[] = ["match", ["downcase", ["get", property]]];
  for (const item of values) match.push(item.name.toLowerCase(), Number(item.value || 0));
  match.push(0);
  return ["interpolate", ["linear"], match, 0, "#f8fafc", max * 0.01, "#dbeafe", max * 0.25, "#93c5fd", max * 0.6, "#3b82f6", max, "#1e3a8a"];
};

type Props = {
  values: GeographicMetric[];
  level?: GeographicLevel;
  county?: string | null;
  subcounty?: string | null;
  onRegionClick?: (name: string) => void;
  onCountyClick?: (countyName: string) => void;
};

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function KenyaInsuranceMap({ values, level = "county", county, subcounty, onRegionClick, onCountyClick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const valuesRef = useRef(values);
  const clickRef = useRef(onRegionClick ?? onCountyClick);
  const propertyRef = useRef(boundaryNameProperty(level));
  propertyRef.current = boundaryNameProperty(level);
  valuesRef.current = values;
  clickRef.current = onRegionClick ?? onCountyClick;

  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({ container: el.current, style: STYLE, center: [37.9, 0.2], zoom: 5.1, minZoom: 4.5, maxZoom: 14 });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // Registered once for the life of the map so repeated drill-down renders
    // cannot stack stale handlers pointing at the previous boundary level.
    const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };
    const onClick = (event: any) =>
      clickRef.current?.(String(event.features?.[0]?.properties?.[propertyRef.current] ?? ""));
    map.on("mouseenter", "geo-fill", onEnter);
    map.on("mouseleave", "geo-fill", onLeave);
    map.on("click", "geo-fill", onClick);
    return () => {
      map.off("mouseenter", "geo-fill", onEnter);
      map.off("mouseleave", "geo-fill", onLeave);
      map.off("click", "geo-fill", onClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const render = async () => {
      if (!map.isStyleLoaded()) { map.once("load", render); return; }
      for (const id of ["geo-label","geo-border","geo-fill"]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource("geo-boundaries")) map.removeSource("geo-boundaries");

      const property = boundaryNameProperty(level);
      const response = await fetch(KENYA_BOUNDARY_SOURCES[level]);
      if (!response.ok) throw new Error(`Unable to load ${level} boundaries`);
      const geojson: any = await response.json();

      if (level !== "county") {
        geojson.features = (geojson.features ?? []).filter((feature: any) => {
          const p = feature.properties ?? {};
          const countyMatches = !county || normalizeBoundaryName(p.county_name) === normalizeBoundaryName(county);
          const subcountyMatches = level !== "ward" || !subcounty || normalizeBoundaryName(p.constituency_name) === normalizeBoundaryName(subcounty);
          return countyMatches && subcountyMatches;
        });
      }

      map.addSource("geo-boundaries", { type: "geojson", data: geojson });
      map.addLayer({ id:"geo-fill", type:"fill", source:"geo-boundaries", paint:{ "fill-color":colorExpression(valuesRef.current, property), "fill-opacity":0.72 } });
      map.addLayer({ id:"geo-border", type:"line", source:"geo-boundaries", paint:{ "line-color":"#334155", "line-width":1 } });
      map.addLayer({ id:"geo-label", type:"symbol", source:"geo-boundaries", layout:{ "text-field":["get",property], "text-size":11, "text-max-width":8 }, paint:{ "text-halo-color":"#ffffff", "text-halo-width":1.5 } });

      const source = map.getSource("geo-boundaries") as maplibregl.GeoJSONSource;
      const data: any = (source as any)._data ?? geojson;
      const bounds = new maplibregl.LngLatBounds();
      const walk = (coords:any) => Array.isArray(coords?.[0]) ? coords.forEach(walk) : bounds.extend(coords as [number,number]);
      for (const feature of data.features ?? []) walk(feature.geometry?.coordinates);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 45, duration: 700, maxZoom: level === "county" ? 6.5 : level === "subcounty" ? 9 : 12 });

    };
    void render();
  }, [level, county, subcounty]);

  useEffect(() => {
    const map=mapRef.current; if(!map?.getLayer("geo-fill")) return;
    map.setPaintProperty("geo-fill","fill-color",colorExpression(values,boundaryNameProperty(level)));
  }, [values,level]);

  return <div ref={el} className="h-[62vh] min-h-[440px] w-full overflow-hidden rounded-lg" aria-label="Interactive insurance analytics map of Kenya" />;
}
