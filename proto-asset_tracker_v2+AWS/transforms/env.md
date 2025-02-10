---
type: shadow
---

# Environment

Creates the environment data from the asset_tracker_v2 shadow document.

## Match Expression

```jsonata
$exists(state.reported.env)
```

## Transform Expression

```jsonata
[
    {"bn": "14205/0/", "n": "0", "v": state.reported.env.v.temp, "bt": state.reported.env.ts },
    {"n": "1", "v": state.reported.env.v.hum },
    {"n": "2", "v": state.reported.env.v.atmp },
    {"n": "10", "v": state.reported.env.v.bsec_iaq }
]
```

## Input Example

```json
{
  "state": {
    "reported": {
      "env": {
        "v": {
          "temp": 27.06,
          "hum": 31.125,
          "atmp": 97.748,
          "bsec_iaq": 148
        },
        "ts": 1699050061608
      }
    }
  }
}
```

## Result Example

```json
[
  {
    "bn": "14205/0/",
    "n": "0",
    "v": 27.06,
    "bt": 1699050061608
  },
  {
    "n": "1",
    "v": 31.125
  },
  {
    "n": "2",
    "v": 97.748
  },
  {
    "n": "10",
    "v": 148
  }
]
```
