---
type: shadow
---

# Roaming information

Creates the roaming data from the asset_tracker_v2 shadow document.

## Match Expression

```jsonata
$exists(state.reported.roam)
```

## Transform Expression

```jsonata
[
    {"bn": "14203/0/", "n": "0", "vs": state.reported.roam.v.nw, "bt": state.reported.roam.ts },
    {"n": "1", "v": state.reported.roam.v.band },
    {"bn": "14203/0/", "n": "2", "v": state.reported.roam.v.rsrp, "bt": state.reported.roam.ts },
    {"n": "3", "v": state.reported.roam.v.area },
    {"n": "4", "v": state.reported.roam.v.cell },
    {"n": "5", "v": state.reported.roam.v.mccmnc },
    {"n": "6", "vs": state.reported.roam.v.ip },
    {"bn": "14203/0/", "n": "11", "v": state.reported.roam.v.eest, "bt": state.reported.roam.ts }
]
```

`rsrp` and `eest` are also reported in a message only containing these
properties, so the `bn` and `bt` properties are repeated.

## Input Example

```json
{
  "state": {
    "reported": {
      "roam": {
        "v": {
          "band": 20,
          "nw": "LTE-M",
          "rsrp": -89,
          "area": 2305,
          "mccmnc": 24202,
          "cell": 34784790,
          "ip": "100.81.95.75",
          "eest": 7
        },
        "ts": 1699049665511
      }
    }
  }
}
```

## Result Example

```json
[
  {
    "bn": "14203/0/",
    "n": "0",
    "vs": "LTE-M",
    "bt": 1699049665511
  },
  {
    "n": "1",
    "v": 20
  },
  {
    "bn": "14203/0/",
    "n": "2",
    "v": -89,
    "bt": 1699049665511
  },
  {
    "n": "3",
    "v": 2305
  },
  {
    "n": "4",
    "v": 34784790
  },
  {
    "n": "5",
    "v": 24202
  },
  {
    "n": "6",
    "vs": "100.81.95.75"
  },
  {
    "bn": "14203/0/",
    "n": "11",
    "v": 7,
    "bt": 1699049665511
  }
]
```
