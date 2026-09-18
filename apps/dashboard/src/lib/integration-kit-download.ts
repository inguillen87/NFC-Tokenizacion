export async function readIntegrationKitBytes(response:Response,expectedBytes:number){
 if(!response.body||!Number.isSafeInteger(expectedBytes)||expectedBytes<1||expectedBytes>512000)throw new Error('Descarga no disponible.');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let count=0;
 try {
  while(true){const result=await reader.read();if(result.done)break;count+=result.value.byteLength;if(count>expectedBytes)throw new Error('La descarga excede el tamaño autorizado.');chunks.push(result.value);}
  if(count!==expectedBytes)throw new Error('Descarga incompleta.');
  const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
 }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
