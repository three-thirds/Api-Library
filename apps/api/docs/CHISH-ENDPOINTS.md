# Chish's endpoints

## Global Conventions

Base url is `http://localhost:3000` on dev and `https://api.threethird.dev` on prod

### Standard error schema

```json
{
  "error": "Error Message",
  "details": "Optional Upstream error message"
}
```

| Code  | Meaning        | Cause                                  |
| ----- | -------------- | -------------------------------------- |
| `200` | OK             | Success :)                             |
| `400` | Bad Request    | Missing or invalid path                |
| `403` | Forbidden      | Can't access the stuff                 |
| `404` | Not Found      | Resource does not exist                |
| `500` | Internal Error | Failure on Runtime                     |
| `502` | Bad Gateway    | Third Party service failed or time out |

---

## 1. Minecraft service (`/minecraft`)

Provides multiplayer server telemetry and raw icon decoding decoding via TCP status
aggregation.

### Get server info

Returns operational status, player counts, protocal version, and a santized
MOTD without Minecraft formatting

- **Method** - GET
- **Path** - `/minecraft/{server}`
- **Caching** - in-memory, 60 seconds TTL (`cached: true/false`)

#### Parameters

| Parameter | Type   | In   | Required | Description                                                |
| --------- | ------ | ---- | -------- | ---------------------------------------------------------- |
| `server`  | string | Path | Yes      | Server hostname or IP (e.g., `mc.hypixel.net`, `2b2t.org`) |

#### Example Request

```bash
curl http://localhost:3000/minecraft/2b2t.org
```

#### Example Response (`200 OK`)

```json
{
  "online": true,
  "ip": "144.217.10.166",
  "port": 25565,
  "version": "1.12.2 - 1.20.4",
  "players": {
    "online": 412,
    "max": 1050
  },
  "motd": "2b2t is a Minecraft server with no rules.",
  "cached": false
}
```

---

## 2. Status Page Auditor (`/status`)

Verifies third-party status pages by comparing their declared operational claims against live, high-resolution monotonic network probes.

### 2.1 List Supported Services

Returns all services currently configured for status auditing.

- **Method:** `GET`
- **Path:** `/status`

#### Example Response (`200 OK`)

```json
{
  "description": "Status Page Lie Detector: Compares official status claims against live latency probes.",
  "supported_services": ["github", "vercel", "cloudflare"]
}
```

---

### 2.2 Audit Single Service

Executes a parallel request to the target service's official Statuspage API while simultaneously measuring direct TCP/HTTP latency via `performance.now()` against a live production endpoint.

- **Method:** `GET`
- **Path:** `/status/:service`

#### Parameters

| Parameter | Type   | In   | Required | Description                                            |
| :-------- | :----- | :--- | :------- | :----------------------------------------------------- |
| `service` | string | Path | Yes      | Target identifier: `github`, `vercel`, or `cloudflare` |

#### Scoring Heuristic

- **90–100:** Truthful. Live probe matches declared operational status.
- **40–60:** Suspicious. Declared "Operational", but observed latency is degraded (>2,500ms).
- **0–10:** Severe Discrepancy. Declared "Operational", but probe returned HTTP 5xx or timed out.

#### Example Request

```bash
curl http://localhost:3000/status/vercel
```

#### Example Response (`200 OK`)

```json
{
  "service": "Vercel",
  "official_claim": "All Systems Operational",
  "official_indicator": "none",
  "live_probe": {
    "reachable": true,
    "status": 200,
    "latencyMs": 62
  },
  "trust_score": "99/100",
  "verdict": "Truthful: Fast response time matches operational status claim.",
  "timestamp": "2026-09-25T11:15:30.000Z"
}
```

---

### 2.3 Global Status Matrix

Audits all registered services concurrently using event-loop multiplexing (`Promise.all`), returning the complete network health matrix in a single round-trip.

- **Method:** `GET`
- **Path:** `/status/all`

#### Example Request

```bash
curl http://localhost:3000/status/all
```

#### Example Response (`200 OK`)

```json
{
  "audited_services": 3,
  "timestamp": "2026-09-25T11:15:40.000Z",
  "results": [
    {
      "service": "GitHub",
      "id": "github",
      "trust_score": "99/100",
      "verdict": "Truthful: Fast response time matches operational status claim.",
      "latency_ms": 280,
      "reachable": true,
      "official_claim": "All Systems Operational"
    },
    {
      "service": "Vercel",
      "id": "vercel",
      "trust_score": "99/100",
      "verdict": "Truthful: Fast response time matches operational status claim.",
      "latency_ms": 64,
      "reachable": true,
      "official_claim": "All Systems Operational"
    },
    {
      "service": "Cloudflare",
      "id": "cloudflare",
      "trust_score": "99/100",
      "verdict": "Truthful: Fast response time matches operational status claim.",
      "latency_ms": 68,
      "reachable": true,
      "official_claim": "All Systems Operational"
    }
  ]
}
```

---

## 3. DNS-over-HTTPS Resolver (`/dns`)

Resolves DNS records over encrypted HTTPS (DoH / RFC 8484) via Cloudflare's edge resolvers, bypassing unencrypted UDP port 53.

### 3.1 Standard Record Resolution

Resolves both IPv4 (`A`) and IPv6 (`AAAA`) records for a target hostname.

- **Method:** `GET`
- **Path:** `/dns/:domain`

#### Parameters

| Parameter | Type   | In   | Required | Description                        |
| :-------- | :----- | :--- | :------- | :--------------------------------- |
| `domain`  | string | Path | Yes      | Fully Qualified Domain Name (FQDN) |

#### Example Request

```bash
curl http://localhost:3000/dns/github.com
```

#### Example Response (`200 OK`)

```json
{
  "domain": "github.com",
  "status": "NOERROR",
  "resolved_records": 2,
  "records": [
    {
      "type": "A",
      "ip": "140.82.112.4",
      "ttl": 60
    },
    {
      "type": "AAAA",
      "ip": "2606:50c0:8000::153",
      "ttl": 60
    }
  ]
}
```

---

### 3.2 Specific Record Query

Resolves a specific DNS record type defined in RFC 1035 / RFC 3596.

- **Method:** `GET`
- **Path:** `/dns/:domain/:type`

#### Parameters

| Parameter | Type   | In   | Required | Description                             |
| :-------- | :----- | :--- | :------- | :-------------------------------------- |
| `domain`  | string | Path | Yes      | Fully Qualified Domain Name (FQDN)      |
| `type`    | string | Path | Yes      | `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS` |

#### Example Request

```bash
curl http://localhost:3000/dns/google.com/mx
```

#### Example Response (`200 OK`)

```json
{
  "domain": "google.com",
  "type": "MX",
  "status": "NOERROR",
  "answers": [
    {
      "data": "10 smtp.google.com.",
      "ttl": 300
    }
  ]
}
```

---

## 4. Hackatime Telemetry (`/hackatime`)

Normalizes and caches user statistics, active coding sessions, and global rankings from Hack Club's WakaTime-compatible telemetry infrastructure.

### 4.1 Get Detailed User Stats

Fetches total coding hours, daily averages, streaks, trust factor rating, and breakdowns across languages, projects, and text editors.

- **Method:** `GET`
- **Path:** `/hackatime/user/:username`
- **Caching:** In-memory, 5-minute TTL.
- **Upstream Requirement:** Requires the target user to have public stats lookup enabled in their Hackatime configuration.

#### Parameters

| Parameter  | Type    | In    | Required | Default | Description                                       |
| :--------- | :------ | :---- | :------- | :------ | :------------------------------------------------ |
| `username` | string  | Path  | Yes      | —       | Slack UID, username, or internal ID               |
| `no_ai`    | boolean | Query | No       | `false` | When `true`, filters out the "ai coding" category |

#### Example Request

```bash
curl "http://localhost:3000/hackatime/user/chish?no_ai=true"
```

#### Example Response (`200 OK`)

```json
{
  "username": "chish",
  "total_seconds": 93600,
  "total_hours": 26.0,
  "daily_average_hours": 3.7,
  "streak_days": 8,
  "trust_factor": "green",
  "languages": [
    { "name": "Rust", "hours": 15.2, "percent": 58.5 },
    { "name": "Zig", "hours": 7.4, "percent": 28.5 },
    { "name": "TypeScript", "hours": 3.4, "percent": 13.0 }
  ],
  "projects": [
    { "name": "memebin", "hours": 15.2, "percent": 58.5 },
    { "name": "bedrock-db", "hours": 7.4, "percent": 28.5 },
    { "name": "ApiContrib", "hours": 3.4, "percent": 13.0 }
  ],
  "editors": [{ "name": "Neovim", "hours": 26.0, "percent": 100.0 }],
  "cached": false
}
```

#### Error States

- `403 Forbidden`: `User '<username>' has disabled public stats lookup.`
- `404 Not Found`: `User '<username>' not found.`

---

### 4.2 Live Active Hackers

Returns all Hack Club members who have recorded a direct-entry coding heartbeat within the last 5 minutes, including current active projects and repository URLs.

- **Method:** `GET`
- **Path:** `/hackatime/currently-hacking`
- **Caching:** In-memory, 60-second TTL.

#### Example Request

```bash
curl http://localhost:3000/hackatime/currently-hacking
```

#### Example Response (`200 OK`)

```json
{
  "count": 14,
  "users": [
    {
      "display_name": "Orpheus",
      "avatar_url": "https://hackatime.hackclub.com/images/athena.png",
      "country_code": "US",
      "working_on": {
        "project_name": "hackatime",
        "repo_url": "https://github.com/hackclub/hackatime"
      }
    }
  ],
  "cached": false
}
```

---

### 4.3 Weekly Leaderboard

Retrieves the current rolling 7-day coding leaderboard.

- **Method:** `GET`
- **Path:** `/hackatime/leaderboard`
- **Caching:** In-memory, 5-minute TTL.

#### Example Request

```bash
curl http://localhost:3000/hackatime/leaderboard
```

#### Example Response (`200 OK`)

```json
{
  "period": "last_7_days",
  "generated_at": "2026-09-25T10:00:00Z",
  "top_coders": [
    {
      "rank": 1,
      "username": "goat_heidi",
      "avatar_url": "https://...",
      "hours": 42.5
    },
    {
      "rank": 2,
      "username": "chish",
      "avatar_url": "https://...",
      "hours": 26.0
    }
  ],
  "cached": false
}
```

#### Error States

- `503 Service Unavailable`: Leaderboard is actively undergoing scheduled generation by Hackatime.
