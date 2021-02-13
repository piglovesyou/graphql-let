import execa, { ExecaChildProcess } from 'execa';
import terminate from 'terminate';

export async function killApp(app: ExecaChildProcess) {
  console.info(`Terminating app ${app.pid}...`);
  await new Promise((resolve, reject) => {
    terminate(app.pid, (err: any) => {
      if (err) return reject(err);
      return resolve(undefined);
    });
  });
  console.info(`App ${app.pid} was terminated`);
}

export function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function spawn(
  command: string,
  args: string[],
  opts?: execa.CommonOptions<'utf-8'>,
) {
  return execa(command, args, {
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    ...opts,
  });
}
