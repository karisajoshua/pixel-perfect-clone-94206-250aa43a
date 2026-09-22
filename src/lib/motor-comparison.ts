export type MotorRate = {
  insurer_id:string; cover_type:string; vehicle_category:string;
  rate_percent:number|null; flat_premium:number|null; minimum_premium:number|null;
  excess_summary?:string|null; benefits_summary?:string|null; underwriting_notes?:string|null;
  insurers?:{name:string}|null;
};
export type MotorComparison = MotorRate & { estimated_premium:number };

export function compareMotorRates(rates:MotorRate[], sumInsured:number):MotorComparison[] {
  return rates.map(r=>{
    const percentage=r.rate_percent==null?0:(sumInsured*Number(r.rate_percent))/100;
    const base=r.flat_premium==null?percentage:Number(r.flat_premium);
    const estimated=Math.max(base,Number(r.minimum_premium??0));
    return {...r,estimated_premium:Math.round(estimated*100)/100};
  }).sort((a,b)=>a.estimated_premium-b.estimated_premium);
}
