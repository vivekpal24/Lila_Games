import { parquetReadObjects, parquetMetadata } from 'hyparquet';
import fs from 'fs';

async function peekData() {
  const filePath = 'public/data/February_11/00f02e70-ec72-4411-9078-0d98939caa62_95134f01-7755-4dfa-a86c-36becd412e20.nakama-0';
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const nodeBuffer = fs.readFileSync(filePath);
  const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
  
  try {
    const metadata = parquetMetadata(arrayBuffer);
    console.log('--- Columns in Schema ---');
    metadata.schema.forEach((s, i) => {
      if (i > 0) {
        console.log(`- ${s.name}`);
      }
    });

    console.log('\n--- First Row (as Object) ---');
    const objects = await parquetReadObjects({
      file: arrayBuffer,
      limit: 1
    });
    console.log(JSON.stringify(objects[0], null, 2));
  } catch (err) {
    console.error('Error reading parquet:', err);
  }
}

peekData();
