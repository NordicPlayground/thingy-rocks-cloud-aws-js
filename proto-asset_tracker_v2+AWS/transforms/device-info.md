---
type: shadow
---

# Device Information

## Match Expression

```jsonata
$exists(state.reported.dev)
```

## Transform Expression

```jsonata
[
    {"bn": "14204/0/", "n": "0", "vs": state.reported.dev.v.imei, "bt": state.reported.dev.ts },
    {"n": "1", "vs": state.reported.dev.v.iccid },
    {"n": "2", "vs": state.reported.dev.v.modV },
    {"n": "3", "vs": state.reported.dev.v.appV },
    {"n": "4", "vs": state.reported.dev.v.brdV }
]
```

## Input Example

```json
{
  "state": {
    "reported": {
      "dev": {
        "v": {
          "imei": "358299840016535",
          "iccid": "89450421180216254864",
          "modV": "mfw_nrf91x1_2.0.0-77.beta",
          "brdV": "thingy91x_nrf9161",
          "appV": "0.0.0-development"
        },
        "ts": 1699284007851
      }
    }
  }
}
```

## Result Example

```json
[
  {
    "bn": "14204/0/",
    "n": "0",
    "vs": "358299840016535",
    "bt": 1699284007851
  },
  { "n": "1", "vs": "89450421180216254864" },
  { "n": "2", "vs": "mfw_nrf91x1_2.0.0-77.beta" },
  { "n": "3", "vs": "0.0.0-development" },
  { "n": "4", "vs": "thingy91x_nrf9161" }
]
```
