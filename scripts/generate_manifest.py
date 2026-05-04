import os
import json

def generate_manifest():
    data_dir = 'public/data'
    maps = ["AmbroseValley", "GrandRift", "Lockdown"]
    dates = []
    files = []

    # Scan for date folders
    for entry in sorted(os.listdir(data_dir)):
        entry_path = os.path.join(data_dir, entry)
        if os.path.isdir(entry_path) and entry.startswith('February_'):
            # Convert 'February_11' to '2026-02-11' format for the UI
            day = entry.split('_')[1]
            date_str = f"2026-02-{day}"
            dates.append(date_str)

            # Scan for parquet files in the date folder
            for f in os.listdir(entry_path):
                if f.endswith('.parquet'):
                    # Determine mapId from filename
                    map_id = None
                    for m in maps:
                        if m in f:
                            map_id = m
                            break
                    
                    if map_id:
                        files.append({
                            "date": date_str,
                            "mapId": map_id,
                            "path": f"{entry}/{f}"
                        })

    manifest = {
        "maps": maps,
        "dates": sorted(list(set(dates))),
        "files": files
    }

    with open(os.path.join(data_dir, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"Generated manifest.json with {len(files)} files.")

if __name__ == "__main__":
    generate_manifest()
