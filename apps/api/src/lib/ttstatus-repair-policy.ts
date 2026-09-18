/** Repair is not a carrier conversion: require the already registered TagTamper profile. */
export function canRepairRegisteredTagTamper(column:unknown,config:unknown){
 const row=typeof column==='string'?column.trim().toLowerCase():'';
 const value=config&&typeof config==='object'&&!Array.isArray(config)?(config as Record<string,unknown>).carrier_profile_code:null;
 const nested=typeof value==='string'?value.trim().toLowerCase():'';
 return (row||nested)==='ntag424_dna_tt'&&(!row||!nested||row===nested);
}
