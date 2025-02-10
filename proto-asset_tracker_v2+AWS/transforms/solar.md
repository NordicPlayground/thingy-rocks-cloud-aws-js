---
type: shadow
---

# Solar shield

Data from the solar shield:
https://www.nordicsemi.com/Nordic-news/2023/08/exegers-powerfoyle-shield-enables-unlimited-battery-life-in-development-projects-using-thingy91

## Match Expression

```jsonata
$exists(state.reported.sol)
```

## Transform Expression

```jsonata
[
    {"bn": "14210/0/", "n": "0", "v": state.reported.sol.v.gain, "bt": state.reported.sol.ts },
    {"n": "1", "v": state.reported.sol.v.bat }
]
```

## Input Example

```json
{
  "state": {
    "reported": {
      "sol": {
        "v": {
          "gain": 4.391489028930664,
          "bat": 3.872000217437744
        },
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
    "bn": "14210/0/",
    "n": "0",
    "v": 4.391489028930664,
    "bt": 1699050063028
  },
  {
    "n": "1",
    "v": 3.872000217437744
  }
]
```
