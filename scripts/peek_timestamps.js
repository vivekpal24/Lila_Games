import { parquetReadObjects } from 'hyparquet';
import fs from 'fs';

async function peekTimestamps() {
  const filePath = 'public/data/February_11/00f02e70-ec72-4411-9078-0d98939caa62_95134f01-7755-4dfa-a86c-36becd412e20.nakama-0';
  const nodeBuffer = fs.readFileSync(filePath);
  const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
  
  try {
    const objects = await parquetReadObjects({
      file: arrayBuffer,
    });

    if (objects.length > 0) {
      const timestamps = objects.map(o => new Date(o.ts).getTime()).filter(t => !isNaN(t));
      const minTs = Math.min(...timestamps);
      const maxTs = Math.max(...timestamps);
      console.log(`- Total Events: ${objects.length}`);
      console.log(`- Min TS: ${new Date(minTs).toISOString()} (${minTs})`);
      console.log(`- Max TS: ${new Date(maxTs).toISOString()} (${maxTs})`);
      console.log(`- Duration: ${(maxTs - minTs) / 1000} seconds`);
      
      console.log('\n- First 3 Timestamps:', objects.slice(0, 3).map(o => o.ts));
      console.log('- Last 3 Timestamps:', objects.slice(-3).map(o => o.ts));
    }
  } catch (err) {
    console.error('Error reading parquet:', err);
  }
}

peekTimestamps();
