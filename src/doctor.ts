import { spawnSync } from 'node:child_process';
import { promises as dns } from 'node:dns';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CONFIG_FILE, loadConfig, loadDotEnv } from './config.js';
import { STRINGS, type Lang, type Plan } from './cli-utils.js';
import { isPortFree, isPortInUse } from './net-utils.js';

function describePlan(plan: Plan): string {
  const provider = plan.provider ?? 'cloudflare';
  if (plan.target) {
    return `server=${plan.target}, publish=${plan.publish}, provider=${provider}`;
  }
  const parts = [
    `mode=${plan.mode}`,
    `publish=${plan.publish}`,
    `provider=${provider}`,
  ];
  if (plan.publish === 'domain') {
    parts.push(`domain=${plan.domain ?? '?'}`, `port=${plan.port ?? '?'}`);
  }
  return parts.join(', ');
}

export async function runDoctor(lang: Lang): Promise<number> {
  const s = STRINGS[lang];
  let ok = 0;
  let warn = 0;
  let fail = 0;

  const okLine = (message: string) => {
    ok++;
    console.log(`✔ ${message}`);
  };
  const warnLine = (message: string) => {
    warn++;
    console.log(`! ${message}`);
  };
  const failLine = (message: string) => {
    fail++;
    console.log(`✖ ${message}`);
  };

  console.log(`\n${s.doctorTitle}\n`);

  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > 18 || (major === 18 && minor >= 3)) {
    okLine(s.doctorNodeOk(process.versions.node));
  } else {
    failLine(s.doctorNodeFail(process.versions.node));
  }

  loadDotEnv();
  const plan = loadConfig();
  const provider = plan?.provider ?? 'cloudflare';

  if (provider === 'cloudflare') {
    const cloudflared = spawnSync('cloudflared', ['--version'], {
      encoding: 'utf8',
      timeout: 10000,
    });

    if (!cloudflared.error && cloudflared.status === 0) {
      const version =
        (cloudflared.stdout || cloudflared.stderr || '').split(/\r?\n/)[0].trim() ||
        'ok';
      okLine(s.doctorCloudflaredOk(version));
    } else {
      failLine(s.doctorCloudflaredFail);
    }
  }

  if (!plan) {
    if (existsSync(resolve(CONFIG_FILE))) {
      failLine(s.doctorConfigInvalid);
    } else {
      warnLine(s.doctorConfigMissing);
    }
  } else {
    okLine(s.doctorConfigOk(describePlan(plan)));

    if (plan.publish === 'domain') {
      const token = process.env.CLOUDFLARE_TOKEN;
      if (token) {
        okLine(s.doctorTokenOk(token.length));
      } else {
        failLine(s.doctorTokenMissing);
      }
    }

    if (!plan.target) {
      const checkFolder = (dir: string | undefined) => {
        if (!dir) {
          failLine(s.doctorFolderMissing('?'));
          return;
        }
        const abs = resolve(dir);
        if (existsSync(abs) && statSync(abs).isDirectory()) {
          okLine(s.doctorFolderOk(dir));
        } else {
          failLine(s.doctorFolderMissing(dir));
        }
      };

      if (plan.mode !== 'api') checkFolder(plan.public);
      if (plan.mode !== 'site') {
        if (plan.apiMode === 'server') {
          if (plan.api) checkFolder(plan.api);

          const entry =
            plan.apiEntry ?? (plan.api ? join(plan.api, 'index.js') : undefined);
          if (entry) {
            const abs = resolve(entry);
            if (existsSync(abs) && statSync(abs).isFile()) {
              okLine(s.doctorApiEntryOk(entry));
            } else {
              failLine(s.doctorApiEntryMissing(entry));
            }
          } else {
            failLine(s.doctorApiEntryMissing('?'));
          }
        } else {
          checkFolder(plan.api);
        }
      }
    }

    if (plan.target) {
      if (await isPortInUse(plan.target)) {
        okLine(s.doctorTargetUp(plan.target));
      } else {
        failLine(s.doctorTargetDown(plan.target));
      }
    } else if (plan.publish === 'domain' && plan.port) {
      if (await isPortFree(plan.port)) {
        okLine(s.doctorPortFree(plan.port));
      } else {
        failLine(s.doctorPortBusy(plan.port));
      }
    }

    if (plan.publish === 'domain' && plan.domain) {
      try {
        const address = await dns.lookup(plan.domain);
        okLine(s.doctorDnsOk(plan.domain, address.address));
      } catch {
        failLine(s.doctorDnsFail(plan.domain));
      }

      const localPort = plan.target ?? plan.port ?? 3000;
      warnLine(s.doctorHostnameInfo(plan.domain, localPort));
    }
  }

  console.log(`\n${s.doctorSummary(ok, warn, fail)}`);
  if (fail > 0) {
    console.log(s.doctorHasErrors);
    return 1;
  }
  if (plan) {
    console.log(s.doctorAllGood);
  }
  return 0;
}
