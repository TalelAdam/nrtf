# data/

All datasets — raw, processed, calibration, splits, eval. **Nothing in this folder is committed to git.** Use DVC or `_manifest.json` SHAs.

## Layout

```
data/
├── raw/                          # immutable inputs (gitignored, DVC tracked)
│   ├── kilani_leak_v1/           # the leaked KILANI dataset (post-leak addition)
│   │   ├── video/                # original mp4 / mkv
│   │   ├── sensors/              # original csv / parquet
│   │   ├── README.md             # source, license, citation
│   │   └── _manifest.json        # SHA256 + provenance
│   └── external/                 # third-party (NASA POWER, ENTSO-E, public datasets)
├── processed/                    # cleaned + canonicalized (regenerable)
│   ├── video_shards/             # tar shards for webdataset
│   ├── frame_index.parquet       # frame manifest, partitioned by camera+date
│   ├── sensors.parquet           # cleaned sensor data, partitioned by sensor_id+date
│   └── labels/<task>/            # derived labels (PPE, occupancy, plume)
├── calib/                        # calibration sets for edge-ai-optimizer
│   ├── ppe_v1/                   # 500 stratified frames + manifest
│   ├── occupancy_v1/
│   └── particle_v1/              # 200 windows of telemetry
├── splits/                       # frozen split manifests (JSONL of ids)
│   └── <task>_{train,val,test}.jsonl
├── eval/                         # held-out evaluation videos / clips
└── video/                        # working area for video transcodes
```

## Rules

1. **Never edit raw data.** `data/raw/` is immutable. Re-derivable transforms produce `data/processed/`.
2. **Manifest everything.** Each dataset has `_manifest.json` with SHA, row count, build timestamp, transform script SHA.
3. **Splits are files, not seeds.** Generate the JSONL once, commit the manifest, never re-roll.
4. **Calibration ≠ training.** `data/calib/` is a stratified deployment-distribution slice for `edge-ai-optimizer`.
5. **Validation ≠ calibration.** `data/splits/<task>_val.jsonl` is for the trainer; `data/calib/<task>_v1/` is for the quantizer.
6. **Privacy.** Faces blurred in stored frames. Operator IDs anonymized. PII never leaves the edge.

Owner agent: `data-engineer`.
