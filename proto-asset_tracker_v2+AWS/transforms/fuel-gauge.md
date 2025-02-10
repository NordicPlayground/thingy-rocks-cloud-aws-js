---
type: shadow
---

# Battery and Power data from NPM fuel gauge

## Match Expression

```jsonata
$exists(state.reported.fg)
```

## Transform Expression

```jsonata
[
    {"bn": "14202/0/", "n": "0", "v": state.reported.fg.v.SoC, "bt": state.reported.fg.ts },
    {"n": "1", "v": state.reported.fg.v.V/1000 },
    {"n": "2", "v": state.reported.fg.v.I },
    {"n": "3", "v": state.reported.fg.v.T = null ? null : state.reported.fg.v.T/10 },
    {"n": "4", "v": state.reported.fg.v.TTF },
    {"n": "5", "v": state.reported.fg.v.TTE }
]
```

## Input Example

```json
{
  "state": {
    "reported": {
      "fg": {
        "ts": 1699049685992,
        "v": {
          "V": 4179,
          "SoC": 99,
          "I": 0,
          "T": 257,
          "TTE": null,
          "TTF": null
        }
      }
    }
  }
}
```

## Result Example

```json
[
  {
    "bn": "14202/0/",
    "n": "0",
    "v": 99,
    "bt": 1699049685992
  },
  { "n": "1", "v": 4.179 },
  { "n": "2", "v": 0 },
  { "n": "3", "v": 25.7 }
]
```
