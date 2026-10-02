import { main } from "bun";
import { Hono } from "hono";

const app = new Hono();

const KERNEL_ORG_RELEASES = 'https://www.kernel.org/releases.json';

const cache = new Map<string, { data: any, expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

interface KernelRelease {
  version: string;
  iseol: boolean;
  moniker: 'mainline' | 'stable' | 'longterm' | 'linux-next';
  released: {
    isodate: string;
  };
}

async function fetchKernelReleases(): Promise<KernelRelease[]> {
  const cached = cache.get('releases');
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const res = await fetch(KERNEL_ORG_RELEASES, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ApiLib-KernelAPI/1.0'
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!res.ok) {
    throw new Error(`kernel.org returned HTTP ${res.status}`)
  }

  const json = await res.json();
  const releases: KernelRelease[] = json.releases ?? [];

  cache.set('releases', {
    data: releases,
    expiresAt: Date.now() + CACHE_TTL_MS
  });

  return releases;
}

app.get('/latest', async (c) => {
  try {
    const releases = await fetchKernelReleases();

    const mainline = releases.find((r) => r.moniker === 'mainline');
    const stable = releases.find((r) => r.moniker === 'stable');
    const longterm = releases.filter((r) => r.moniker === 'longterm');

    return c.json({
      mainline: mainline ? { version: mainline.version, date: mainline.released.isodate } : null,
      stable: stable ? { version: stable.version, date: stable.released.isodate } : null,
      active_lts_branches: longterm.map((r) => ({
        version: r.version,
        date: r.released.isodate,
      })),
      source: 'https://kernel.org'
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch the Kernel data', details: String(err) }, 502);
  }
});

app.get('/check/:version', async (c) => {
  const inputVersion = c.req.param('version').trim();

  try {
    const releases = await fetchKernelReleases();

    const exactMatch = releases.find((r) => r.version === inputVersion);

    const parts = inputVersion.split('.');
    if (parts.length < 2) {
      return c.json({ error: 'Invalid version format. Expected format like 6.1.100 or smth' }, 400);
    }
    const branchPrefix = `${parts[0]}.${parts[1]}`

    const branchReleases = releases.filter((r) => r.version.startsWith(branchPrefix));
    const latestOnBranch = branchReleases[0];

    const isMainline = releases.some((r) => r.moniker === 'mainline' && r.version === inputVersion);
    const isStable = releases.some((r) => r.moniker === 'stable' && r.version === inputVersion);
    const isLTS = releases.some((r) => r.moniker === 'longterm' && r.version === inputVersion);

    let status = 'EOL (End of Life)';
    let recommendation = `This kernel branch is deprecated. Upgrade to an Active LTS branch or latest stable.`;

    if (isStable || isMainline) {
      status = 'Active (Latest Stable/Mainline)';
      recommendation = 'You are on the latest cutting-edge kernel.';
    } else if (isLTS) {
      if (latestOnBranch && latestOnBranch.version === inputVersion) {
        status = 'Active LTS (Up to Date)';
        recommendation = 'You are running the latest patch release for this LTS branch.';
      } else {
        status = 'Active LTS (Outdated Patch)';
        recommendation = `Upgrade to patch version ${latestOnBranch?.version ?? 'latest'} for security fixes.`;
      }
    }

    return c.json({
      queried_version: inputVersion,
      branch: branchPrefix,
      status,
      is_eol: !isMainline && !isMainline && !isLTS,
      latest_patch_on_branch: latestOnBranch?.version ?? 'None',
      recommendation,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ error: 'Failed to check kernel version', details: String(err) }, 502);
  }
});

export default app;
