import os

folder = "vibration_data"

for filename in os.listdir(folder):
    if filename.endswith(".csv"):
        filepath = os.path.join(folder, filename)
        
        with open(filepath, "r") as f:
            content = f.read()
        
        # Rename the header column
        content = content.replace("timestamp_ms,ax,ay,az", "timestamp,ax,ay,az", 1)
        
        with open(filepath, "w") as f:
            f.write(content)

print("Done! All headers fixed.")