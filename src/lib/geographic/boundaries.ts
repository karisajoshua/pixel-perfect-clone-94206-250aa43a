export type GeographicLevel = "county" | "subcounty" | "ward";

export const KENYA_BOUNDARY_SOURCES = {
  county: "/kenya-counties.geojson",
  // Boundary geometry is sourced from the open Kenya Elections/HDX-derived dataset.
  // Constituencies are used as the map's sub-county drill-down layer because this
  // boundary set is consistently coded county -> constituency -> ward.
  subcounty: "https://raw.githubusercontent.com/tigawanna/kenya_wards_geojson_data/main/src/data/constituencies/constituencies.geojson",
  ward: "https://raw.githubusercontent.com/tigawanna/kenya_wards_geojson_data/main/src/data/wards/wards.geojson",
} as const;

export const boundaryNameProperty = (level: GeographicLevel) =>
  level === "county" ? "county" : level === "subcounty" ? "constituency_name" : "ward_name";

export const normalizeBoundaryName = (value: unknown) =>
  String(value ?? "").toLowerCase().replace(/[’']/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();
