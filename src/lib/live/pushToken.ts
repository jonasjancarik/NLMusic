import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Secreto compartido entre el servidor de NLMusic y el MCP (TASK-29 AC-1).
 *
 * Por qué un archivo y no la IP: en Next 16 los route handlers no ven el socket, y la única
 * pista de la IP de origen es `x-forwarded-for`, que Next rellena con `??=` (si el cliente ya
 * la manda, gana la del cliente). Con el servidor escuchando en 0.0.0.0 (LAN, Tailscale) eso
 * se falsifica con un `curl -H`. Un token aleatorio en un archivo del proyecto con permisos
 * 0600 solo lo puede leer quien ya tiene acceso a la carpeta como el mismo usuario: el MCP
 * y la CLI lo leen; un equipo de la red o una página web no.
 *
 * Quien llega primero (el servidor en la primera petición, o el MCP) crea el archivo con
 * `wx`, así que no hay carrera; el otro lo lee.
 */

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** `<cwd>/.nlmusic/push-token`; `NLMUSIC_PUSH_TOKEN_FILE` lo cambia (MCP lanzado desde otra carpeta). */
export function defaultPushTokenFile(): string {
  // turbopackIgnore: es un archivo de ejecución, no algo que el build deba empaquetar.
  const file = process.env.NLMUSIC_PUSH_TOKEN_FILE || path.join(/*turbopackIgnore: true*/ process.cwd(), '.nlmusic', 'push-token');
  return path.resolve(/*turbopackIgnore: true*/ file);
}

export class PushTokenError extends Error {}

function readExisting(file: string): string {
  const stat = fs.lstatSync(file);
  if (!stat.isFile()) {
    throw new PushTokenError(`${file} is not a regular file (symbolic links are refused). Delete it and retry.`);
  }
  if (typeof process.getuid === 'function') {
    if (stat.uid !== process.getuid()) {
      throw new PushTokenError(`${file} belongs to another user. Delete it and retry.`);
    }
    if ((stat.mode & 0o077) !== 0) {
      throw new PushTokenError(`${file} can be read by other users. Run: chmod 600 "${file}"`);
    }
  }
  const token = fs.readFileSync(file, 'utf8').trim();
  if (!TOKEN_PATTERN.test(token)) {
    throw new PushTokenError(`${file} does not contain a valid token. Delete it and retry.`);
  }
  return token;
}

/** Lee el token, o lo crea (0600, carpeta 0700) si todavía no existe. */
export function ensurePushToken(file: string = defaultPushTokenFile()): string {
  try {
    return readExisting(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  try {
    fs.writeFileSync(file, `${token}\n`, { flag: 'wx', mode: 0o600 });
    return token;
  } catch (error) {
    // Otro proceso lo creó entre medias: el suyo es el bueno.
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return readExisting(file);
    throw error;
  }
}

/** Comparación en tiempo constante de `Authorization: Bearer <token>`. */
export function isAuthorized(header: string | null, expected: string): boolean {
  const match = /^Bearer ([0-9a-f]{64})$/.exec(header?.trim() ?? '');
  if (!match) return false;
  const given = Buffer.from(match[1], 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}
