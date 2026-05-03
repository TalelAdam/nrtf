import os
import pandas as pd

folder = "vibration_data"

for filename in os.listdir(folder):
    if not filename.endswith(".csv"):
        continue
    
    filepath = os.path.join(folder, filename)
    df = pd.read_csv(filepath)
    
    # Reset timestamp to start from 0
    df["timestamp"] = df["timestamp"] - df["timestamp"].iloc[0]
    
    df.to_csv(filepath, index=False)
    print(f"Fixed: {filename}")

print("All done!")