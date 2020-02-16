import { ExecaChildProcess } from 'execa';
import terminate from 'terminate';
import i from 'log-symbols';
import waitOn from 'wait-on';

export function success(...args: string[]) {
  return console.info(i.success, ...args);
}

export function info(...args: string[]) {
  return console.info(i.info, ...args);
}

export function getUrl(port: number) {
  return `http://localhost:${port}`;
}

export async function waitApp(port: number) {
  const url = getUrl(port);
  await waitOn({
    resources: [url],
    timeout: 60 * 1000,
  });
}

export async function killApp(app: ExecaChildProcess) {
  info(`Terminating app ${app.pid}...`);
  await new Promise((resolve, reject) => {
    terminate(app.pid, (err: any) => {
      if (err) return reject(err);
      return resolve();
    });
  });
  success(`App ${app.pid} was terminated`);
}

export function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
