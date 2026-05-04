import { parquetReadObjects } from 'hyparquet';
import fs from 'fs';

async function check() {
  const m = JSON.parse(fs.readFileSync('./public/data/manifest.json', 'utf-8'));
  
  const resultsByDate = {};
  const matchToMap = {};

  for (const entry of m.entries) {
    if (matchToMap[entry.matchId]) continue; 
    
    try {
      const nodeBuffer = fs.readFileSync('./public/data/' + entry.path);
      const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
      
      const objects = await parquetReadObjects({ file: arrayBuffer, limit: 1 });
      if (objects.length > 0) {
        const rawMapId = objects[0].map_id;
        const mapIdStr = typeof rawMapId === 'string' ? rawMapId : new TextDecoder('utf-8').decode(rawMapId);
        matchToMap[entry.matchId] = mapIdStr;
        
        if (!resultsByDate[entry.date]) resultsByDate[entry.date] = {};
        resultsByDate[entry.date][mapIdStr] = (resultsByDate[entry.date][mapIdStr] || 0) + 1;
      }
    } catch(e) {}
  }
  
  console.log(resultsByDate);
}

check();
