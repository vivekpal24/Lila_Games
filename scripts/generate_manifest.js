import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parquetReadObjects } from 'hyparquet';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateManifest() {
  const dataDir = path.join(__dirname, '../public/data');
  const entries = [];

  const folders = fs.readdirSync(dataDir).filter(f => 
    fs.statSync(path.join(dataDir, f)).isDirectory() && f.startsWith('February_')
  );

  console.log(`Processing ${folders.length} folders...`);

  for (const folder of folders) {
    const folderPath = path.join(dataDir, folder);
    const day = folder.split('_')[1];
    const date = `2026-02-${day.padStart(2, '0')}`;

    const files = fs.readdirSync(folderPath);
    console.log(`- ${folder}: ${files.length} files`);

    for (const file of files) {
      if (file.includes('.nakama') || file.endsWith('.parquet')) {
        const filePath = path.join(folderPath, file);
        
        try {
          const nodeBuffer = fs.readFileSync(filePath);
          const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
          
          const objects = await parquetReadObjects({
            file: arrayBuffer,
            limit: 1
          });

          if (objects.length > 0) {
            const row = objects[0];
            const mapId = row.map_id || "AmbroseValley";
            const userId = row.user_id || file.split('_')[0];
            const matchId = row.match_id ? String(row.match_id).split('.')[0] : file.split('_')[1].split('.')[0];
            let tsNum = 0;
            if (typeof row.ts === 'number') tsNum = row.ts;
            else if (typeof row.ts === 'bigint') tsNum = Number(row.ts);
            else if (row.ts) tsNum = new Date(row.ts).getTime();

            // Handle seconds vs milliseconds
            if (tsNum > 0 && tsNum < 1_000_000_000_000) tsNum *= 1000;

            const entryDate = tsNum > 0 ? new Date(tsNum).toISOString().split('T')[0] : date;

            entries.push({
              date: entryDate,
              folder,
              path: `${folder}/${file}`,
              userId,
              matchId,
              mapId
            });
          }
        } catch (err) {
          console.error(`Error processing ${file}:`, err.message);
        }
      }
    }
  }

  const manifest = {
    generated: new Date().toISOString(),
    totalFiles: entries.length,
    entries: entries
  };

  fs.writeFileSync(path.join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nSuccess! Generated manifest.json with ${entries.length} validated entries.`);
}

generateManifest().catch(console.error);
