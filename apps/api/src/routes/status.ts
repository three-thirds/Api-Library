import { Hono } from "hono";

const app = new Hono();


const SERVICES: Record<string, { name: string; statusUrl: string; probeUrl: string }> = {
  github: {
    name: 'Github',
    statusUrl: 'https://www.githubstatus.com/api/v2/status.json',
    probeUrl: 'https://api.github.com/zen',
  },
  vercel: {
    name: 'vercel',
    statusUrl: 'https://www.vercel-status.com/api/v2/status.json',
    probeUrl: 'https://vercel.com',
  },
  cloudflare: {
    name: 'Cloudflare',
    statusUrl: 'https://www.cloudflarestatus.com/api/v2/status.json',
    probeUrl: 'https://1.1.1.1/cdn-cgi/trace',
  },
};

function calculateTrust(probe: { reachable: boolean; status: number; latencyMs: number }, official: { indicator: string } | null) {
  const indicator = official?.indicator ?? "unknown";

  if (!probe.reachable) {
    return indicator == 'none' ?
      { score: 5, verdict: "LYING: Link is down but status page says up" }
      : { score: 95, verdict: "Honest: Status page claimed the outage, website can't be reached" };
  }

  if (probe.status >= 500) {
    return indicator === "none"
      ? { score: 10, verdict: `Discrepancy: Probe returned ${probe.status} despite operational claim!` }
      : { score: 90, verdict: 'Accurate: Service errors match active incident warning.' };
  }

  if (probe.latencyMs >= 2500) {
    return indicator === "none"
      ? { score: 45, verdict: 'Suspicious: Claiming fully operational, but probe latency is degraded (${probe.latencyMs}ms).' }
      : { score: 85, verdict: 'Accurate: High latency matches reported incident.' };
  }

  return { score: 99, verdict: 'Everything is working fine :D' };
}

async function probeEndpoint(url: string) {
  const start = performance.now();

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    const latency = Math.round(performance.now() - start);
    return { reachable: true, status: res.status, latencyMs: latency };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return { reachable: false, status: 0, latencyMs: latency };
  }
}

async function fetchOfficialStatus(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      indicator: data.status?.indicator ?? 'unknown', // 'none', 'minor', 'major', 'critical'
      description: data.status?.description ?? 'unknown'
    };

  } catch {
    return null;
  }
}

app.get('/:service', async (c) => {
  const serviceKey = c.req.param("service").toLowerCase();
  const target = SERVICES[serviceKey];

  if (!target) {
    return c.json({ error: `Unknown service: ${serviceKey}`, supported: Object.keys(SERVICES) }, 404);
  }

  const [probe, official] = await Promise.all([
    probeEndpoint(target.probeUrl),
    fetchOfficialStatus(target.statusUrl)
  ]);

  const { score, verdict } = calculateTrust(probe, official);

  return c.json({
    service: target.name,
    official_claim: official?.description ?? 'No Status page data',
    official_indicator: official?.indicator ?? 'unknown',
    live_probe: probe,
    trust_score: `${score}/100`,
    verdict,
    timestamp: new Date().toISOString(),
  });
});

export default app;
