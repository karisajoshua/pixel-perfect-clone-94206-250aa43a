export const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa","Homa Bay","Isiolo","Kajiado",
  "Kakamega","Kericho","Kiambu","Kilifi","Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu",
  "Machakos","Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a","Nairobi","Nakuru","Nandi",
  "Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya","Taita-Taveta","Tana River","Tharaka-Nithi",
  "Trans Nzoia","Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot",
] as const;

export type KenyaCounty = (typeof KENYA_COUNTIES)[number];


const COUNTY_ALIASES: Record<string, KenyaCounty> = {
  "nairobi city": "Nairobi", "nairobi county": "Nairobi",
  "mombasa county": "Mombasa", "homabay": "Homa Bay", "homa-bay": "Homa Bay",
  "elgeyo marakwet": "Elgeyo-Marakwet", "keiyo marakwet": "Elgeyo-Marakwet",
  "muranga": "Murang'a", "murang’a": "Murang'a",
  "taita taveta": "Taita-Taveta", "tharaka nithi": "Tharaka-Nithi",
  "trans-nzoia": "Trans Nzoia", "uasin-gishu": "Uasin Gishu",
};

const normalize = (value: string) => value.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

export function resolveKenyaCounty(...parts: Array<string | null | undefined>): KenyaCounty | null {
  const text = normalize(parts.filter(Boolean).join(" "));
  if (!text) return null;
  for (const county of KENYA_COUNTIES) {
    if (text === normalize(county) || text.includes(normalize(county))) return county;
  }
  for (const [alias, county] of Object.entries(COUNTY_ALIASES)) {
    if (text === alias || text.includes(alias)) return county;
  }
  return null;
}
