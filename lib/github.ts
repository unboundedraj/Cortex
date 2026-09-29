import "server-only";
import { Octokit } from "octokit";

let client: Octokit | undefined;

/**
 * Single Octokit client factory. Throws with a clear message if the PAT is
 * missing — callers that need to support running without GitHub configured
 * (see lib/notes.ts's dev fallback) must check `hasGithubConfig()` first
 * rather than relying on catching this.
 */
export function getOctokit(): Octokit {
  if (client) return client;

  const auth = process.env.GITHUB_PAT;
  if (!auth) {
    throw new Error(
      "GITHUB_PAT is not set. Add it to .env.local (see .env.local.example).",
    );
  }

  client = new Octokit({ auth });
  return client;
}

let writeClient: Octokit | undefined;

/**
 * Client for commits. The `octokit` bundle's retry and throttling plugins
 * are disabled here on purpose:
 * - retry: a create that succeeded server-side but timed out client-side
 *   would be re-sent and then look like a slug collision.
 * - throttling: on a rate limit it waits out the reset window (up to an
 *   hour) and retries, stalling the save request instead of failing fast.
 * Writes fail immediately instead, and the caller reports the reset time.
 */
export function getWriteOctokit(): Octokit {
  if (writeClient) return writeClient;

  const auth = process.env.GITHUB_PAT;
  if (!auth) {
    throw new Error(
      "GITHUB_PAT is not set. Add it to .env.local (see .env.local.example).",
    );
  }

  writeClient = new Octokit({
    auth,
    retry: { enabled: false },
    throttle: { enabled: false },
  });
  return writeClient;
}

export function getNotesRepoConfig(): { owner: string; repo: string } {
  const owner = process.env.NOTES_REPO_OWNER;
  const repo = process.env.NOTES_REPO_NAME;
  if (!owner || !repo) {
    throw new Error(
      "NOTES_REPO_OWNER and NOTES_REPO_NAME must be set (see .env.local.example).",
    );
  }
  return { owner, repo };
}

export function hasGithubConfig(): boolean {
  return Boolean(
    process.env.GITHUB_PAT &&
    process.env.NOTES_REPO_OWNER &&
    process.env.NOTES_REPO_NAME,
  );
}
