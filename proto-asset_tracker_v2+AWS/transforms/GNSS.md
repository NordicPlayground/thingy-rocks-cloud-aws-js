---
type: shadow
---

# GNSS fix

## Match Expression

```jsonata
$exists(state.reported.gnss)
```

## Transform Expression

```jsonata
[
    {"bn": "14201/0/", "n": "0", "v": state.reported.gnss.v.lat, "bt": state.reported.gnss.ts },
    {"n": "1", "v": state.reported.gnss.v.lng },
    {"n": "2", "v": state.reported.gnss.v.alt },
    {"n": "3", "v": state.reported.gnss.v.acc },
    {"n": "4", "v": state.reported.gnss.v.spd },
    {"n": "5", "v": state.reported.gnss.v.hdg },
    {"n": "6", "vs": "GNSS" }
]
```

## Input Example

```json
{
  "state": {
    "reported": {
      "gnss": {
        "v": {
          "lng": -84.50632147267358,
          "lat": 33.98771459323253,
          "acc": 11.317643165588379,
          "alt": 241.9342498779297,
          "spd": 0.03478508070111275,
          "hdg": 90.31222534179688
        },
        "ts": 1699049744000
      }
    }
  }
}
```

## Result Example

```json
[
  {
    "bn": "14201/0/",
    "n": "0",
    "v": 33.98771459323253,
    "bt": 1699049744000
  },
  { "n": "1", "v": -84.50632147267358 },
  { "n": "2", "v": 241.9342498779297 },
  { "n": "3", "v": 11.317643165588379 },
  { "n": "4", "v": 0.03478508070111275 },
  { "n": "5", "v": 90.31222534179688 },
  { "n": "6", "vs": "GNSS" }
]
```
