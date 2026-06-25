# AgentBus — Live Usage Record

- **Session ID**: `7ea75f69-a4e`
- **Started**: 2026-06-25T12:39:30.627Z
- **Ended**: 2026-06-25T12:39:55.904Z
- **Duration**: 25.28 seconds
- **Bus ID**: `I9MSnkv3bE`
- **Dashboard URL**: http://localhost:8782
- **Total recorded events**: 42 HTTP + 42 timeline entries

## Summary

- Dashboard HTTP calls (poll + render): **20**
- `/api/publish` calls (manual signals): **21**
- `/api/inject` calls (demo sequences): **1**
- Total HTTP requests: **42**

## Bus events captured

- Raw signals published: **26**
- Scored (passed classifier): **25**
- Dropped as noise: **1**
- Order updates from Bitget adapter (new/filled lifecycle): **50**
- Fills returned by Bitget adapter: **25**

## Agents

| Role | Agent ID | Subscribed to |
|---|---|---|
| 📡 Signaler | `signaler` | on-demand publisher (no subscription) |
| 🤖 Classifier | `qwen-classifier` | `signal.raw.>` |
| ⚡ Executor | `executor` | `signal.scored` (quality ≥ 0.6) |
| 🔌 Bitget Adapter | `bitget-adapter` | responds to `order.bitget.>` |
| 📝 Recorder | `paper-recorder` | `order.bitget.>` → JSONL audit log |

## Timeline

### 1. [2026-06-25T12:39:30.679Z] GET /

**Request**
```json
{
  "method": "GET",
  "url": "/",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "text/html; charset=utf-8"
  },
  "bytes": 6974,
  "body": "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\" />\n<title>AgentBus — two-agent cooperating demo</title>\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n<style>\n  :root {\n    --bg: #0d1117; --panel: #161b22; --border: #30363d;\n    --
... (truncated for readability)

```

### 2. [2026-06-25T12:39:30.686Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 795,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 3,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "signa
... (truncated for readability)

```

### 3. [2026-06-25T12:39:30.700Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "long",
    "confidence": 0.92,
    "rationale": "whale 1.2k BTC added in last hour, CVD positive 18m straight, 4h close above 60k with 2.3x avg volume — breakout confirmed"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "5I--20MsdVYZ"
  }
}

```

### 4. [2026-06-25T12:39:30.705Z] POST /api/inject

**Request**
```json
{
  "method": "POST",
  "url": "/api/inject",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11,
  "body": {
    "ok": true
  }
}

```

### 5. [2026-06-25T12:39:30.708Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 5706,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 30,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "sig
... (truncated for readability)

```

### 6. [2026-06-25T12:39:30.730Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 5706,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 30,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "sig
... (truncated for readability)

```

### 7. [2026-06-25T12:39:31.742Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "short",
    "confidence": 0.6937761721465013,
    "rationale": "l2 dex volume +40% 24h, btc correlation broken, altseason signal"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "EDOdh2cPz18I"
  }
}

```

### 8. [2026-06-25T12:39:31.946Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.83977015579052,
    "rationale": "whale 0x9f..ab added 1,200 BTC in last hour; on-chain confirms"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "C7ez3Tr1Odei"
  }
}

```

### 9. [2026-06-25T12:39:32.350Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 7481,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 40,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "sig
... (truncated for readability)

```

### 10. [2026-06-25T12:39:32.755Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.9770985393180153,
    "rationale": "l2 dex volume +40% 24h, btc correlation broken, altseason signal"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "tSKPmjmmMRuE"
  }
}

```

### 11. [2026-06-25T12:39:33.960Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 8372,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 45,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "sig
... (truncated for readability)

```

### 12. [2026-06-25T12:39:33.964Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "long",
    "confidence": 0.7470192407013796,
    "rationale": "eth/btc ratio breaking out, l2 inflows +15% 24h, gas < 10 gwei"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "k2WSb5Y89NBF"
  }
}

```

### 13. [2026-06-25T12:39:35.567Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 9257,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 50,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "sig
... (truncated for readability)

```

### 14. [2026-06-25T12:39:36.172Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "short",
    "confidence": 0.8068644005615587,
    "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "XFNWeix3tHKm"
  }
}

```

### 15. [2026-06-25T12:39:37.178Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 9812,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 58,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "sig
... (truncated for readability)

```

### 16. [2026-06-25T12:39:37.985Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "short",
    "confidence": 0.88002906984845,
    "rationale": "funding flipped positive, spot CVD 18m green, exchange reserves -0.4%"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "GIioqToRpT4l"
  }
}

```

### 17. [2026-06-25T12:39:38.789Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 9985,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 63,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "sig
... (truncated for readability)

```

### 18. [2026-06-25T12:39:39.396Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "short",
    "confidence": 0.6900237803380492,
    "rationale": "funding flipped positive, spot CVD 18m green, exchange reserves -0.4%"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "GtP-kiIPPC6X"
  }
}

```

### 19. [2026-06-25T12:39:40.401Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 10384,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 68,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "si
... (truncated for readability)

```

### 20. [2026-06-25T12:39:40.806Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.8104471938783341,
    "rationale": "whale 0x9f..ab added 1,200 BTC in last hour; on-chain confirms"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "4SoJEWYvkThZ"
  }
}

```

### 21. [2026-06-25T12:39:42.014Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 10668,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 76,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "si
... (truncated for readability)

```

### 22. [2026-06-25T12:39:43.625Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 10668,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 76,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "si
... (truncated for readability)

```

### 23. [2026-06-25T12:39:43.630Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.8700428348328234,
    "rationale": "funding flipped positive, spot CVD 18m green, exchange reserves -0.4%"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "lPOM6XSMXiK4"
  }
}

```

### 24. [2026-06-25T12:39:44.635Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "short",
    "confidence": 0.9038408032269076,
    "rationale": "l2 dex volume +40% 24h, btc correlation broken, altseason signal"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "0FlU4anoezi4"
  }
}

```

### 25. [2026-06-25T12:39:45.237Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 10855,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 86,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "si
... (truncated for readability)

```

### 26. [2026-06-25T12:39:45.240Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.6390557864313807,
    "rationale": "funding flipped positive, spot CVD 18m green, exchange reserves -0.4%"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "E1rU1eme3YEk"
  }
}

```

### 27. [2026-06-25T12:39:45.646Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "short",
    "confidence": 0.99998667769637,
    "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "Ma4iA2shqezO"
  }
}

```

### 28. [2026-06-25T12:39:46.850Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11235,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 99,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "si
... (truncated for readability)

```

### 29. [2026-06-25T12:39:47.052Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "long",
    "confidence": 0.994701436164215,
    "rationale": "eth/btc ratio breaking out, l2 inflows +15% 24h, gas < 10 gwei"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "vgNDBmfhAbi-"
  }
}

```

### 30. [2026-06-25T12:39:47.255Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "short",
    "confidence": 0.8296787628289926,
    "rationale": "funding flipped positive, spot CVD 18m green, exchange reserves -0.4%"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "MD-qc5--Cn0G"
  }
}

```

### 31. [2026-06-25T12:39:48.457Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11616,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 109,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "s
... (truncated for readability)

```

### 32. [2026-06-25T12:39:48.461Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.7154174538618412,
    "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "edxmn-1XDhF8"
  }
}

```

### 33. [2026-06-25T12:39:48.864Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "short",
    "confidence": 0.6508433875792372,
    "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "7GwsO0NreJpn"
  }
}

```

### 34. [2026-06-25T12:39:50.067Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11780,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 119,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "s
... (truncated for readability)

```

### 35. [2026-06-25T12:39:51.672Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11780,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 122,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "s
... (truncated for readability)

```

### 36. [2026-06-25T12:39:52.476Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "BTCUSDT",
    "direction": "short",
    "confidence": 0.8758868678319058,
    "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "9fnkhk6Hu-FT"
  }
}

```

### 37. [2026-06-25T12:39:53.279Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11760,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 127,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "s
... (truncated for readability)

```

### 38. [2026-06-25T12:39:53.682Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.7804767652394031,
    "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "mjs20bZUHz6L"
  }
}

```

### 39. [2026-06-25T12:39:54.289Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "long",
    "confidence": 0.9345897430489369,
    "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "C-7vNiKatNzg"
  }
}

```

### 40. [2026-06-25T12:39:54.898Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11738,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 137,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "s
... (truncated for readability)

```

### 41. [2026-06-25T12:39:55.101Z] POST /api/publish

**Request**
```json
{
  "method": "POST",
  "url": "/api/publish",
  "body": {
    "symbol": "ETHUSDT",
    "direction": "short",
    "confidence": 0.9695998381940298,
    "rationale": "l2 dex volume +40% 24h, btc correlation broken, altseason signal"
  }
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 31,
  "body": {
    "ok": true,
    "id": "TEGaoW398k2h"
  }
}

```

### 42. [2026-06-25T12:39:55.904Z] GET /api/state

**Request**
```json
{
  "method": "GET",
  "url": "/api/state",
  "body": null
}
```

**Response**
```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "bytes": 11739,
  "body": {
    "busId": "I9MSnkv3bE",
    "agents": [
      {
        "id": "signaler",
        "role": "signaler"
      },
      {
        "id": "qwen-classifier",
        "role": "classifier"
      },
      {
        "id": "executor",
        "role": "executor"
      }
    ],
    "inspect": {
      "id": "I9MSnkv3bE",
      "subscribers": 9,
      "historySize": 145,
      "dropped": 0,
      "transports": 0,
      "queues": [
        {
          "id": "e-5bZqW6",
          "pattern": "order.bitget.>",
          "depth": 0
        },
        {
          "id": "wIF9umxi",
          "pattern": "never",
          "depth": 0
        },
        {
          "id": "EIut5UCs",
          "pattern": "s
... (truncated for readability)

```

## Final bus state

```json
{
  "busId": "I9MSnkv3bE",
  "agents": [
    "signaler",
    "qwen-classifier",
    "executor"
  ],
  "busHistorySize": 145,
  "signalsInHistory": 20,
  "ordersInHistory": 0,
  "fillsInHistory": 20,
  "noiseInHistory": 1,
  "dropped": 0
}
```

## How to reproduce

```bash
git clone https://github.com/Peesounds9/Agentbus.git
cd Agentbus
./scripts/install.sh
node scripts/record-live-usage.mjs
cat logs/live-usage-latest.md
```

The script boots the CoopDemo, drives HTTP traffic against its
dashboard, and writes this report. The session id and timestamps
will differ on each run; the bus topology and HTTP surface are stable.
