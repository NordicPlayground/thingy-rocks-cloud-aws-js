---
type: shadow
---

# Battery voltage (legacy)

The battery voltage reading is legacy and new firmware versions report the stat
of charge instead.

## Match Expression

```jsonata
$exists(state.reported.bat)
```

## Transform Expression

```jsonata
[
    {"bn": "14202/0/", "n": "1", "v": state.reported.bat.v/1000, "bt": state.reported.bat.ts }
]
```

## Input Example

```json
{
  "state": {
    "reported": {
      "bat": {
        "v": 4398,
        "ts": 1699050063028
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
    "n": "1",
    "v": 4.398,
    "bt": 1699050063028
  }
]
```
