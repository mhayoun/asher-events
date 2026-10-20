// Google sign-in in the browser (Google Identity Services, token model), as in MyMedia.
// The token gives the page access to the teacher's Drive: the events folder is managed with it
// directly from the browser, and /api/sync accepts it in place of a password.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** OAuth client (type "Web application"); asherhayoun.com and localhost:3000 must be authorized JavaScript origins. */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "246067015646-63ga5nqjgihi3sd8mmb3ch0urb0i1q5m.apps.googleusercontent.com";

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

export type AuthState = { status: "signedOut" | "signedIn" | "expired"; email?: string; error?: string };

const TOKEN_KEY = "admin.token";
const EMAIL_KEY = "admin.email";
/** Tokens last an hour; consider them expired a minute early so requests don't fail midway. */
const EXPIRY_MARGIN_MS = 60_000;

type Stored = { accessToken: string; expiresAt: number };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

class GoogleAuth {
  private client: TokenClient | null = null;
  private token: Stored | null = null;
  private waiters: ((token: string) => void)[] = [];
  private listeners = new Set<() => void>();
  state: AuthState = { status: "signedOut" };

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private set(state: AuthState) {
    this.state = state;
    for (const fn of this.listeners) fn();
  }

  private valid() {
    return !!this.token && this.token.expiresAt - EXPIRY_MARGIN_MS > Date.now();
  }

  async init() {
    if (this.client) return;
    this.token = read<Stored>(TOKEN_KEY);
    const email = read<string>(EMAIL_KEY) ?? undefined;
    if (email) this.set({ status: this.valid() ? "signedIn" : "expired", email });
    await loadScript("https://accounts.google.com/gsi/client");
    this.client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (r) => void this.onToken(r),
      error_callback: (e) => this.set({ ...this.state, error: e.type }),
    });
  }

  private async onToken(r: TokenResponse) {
    if (r.error || !r.access_token) return this.set({ ...this.state, error: r.error ?? "unknown" });
    if (!window.google!.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE))
      return this.set({ status: "signedOut", error: "scope_denied" });
    this.token = { accessToken: r.access_token, expiresAt: Date.now() + Number(r.expires_in ?? 3600) * 1000 };
    write(TOKEN_KEY, this.token);
    let email = this.state.email;
    try {
      const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
        headers: { Authorization: `Bearer ${r.access_token}` },
      });
      email = (await res.json()).user?.emailAddress ?? email;
    } catch {}
    write(EMAIL_KEY, email);
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w(r.access_token);
    this.set({ status: "signedIn", email });
  }

  /** Opens Google's window: must be called from a click. */
  signIn(chooseAccount = false) {
    const email = this.state.email;
    this.client?.requestAccessToken(chooseAccount || !email ? { prompt: "select_account" } : { prompt: "", login_hint: email });
  }

  /** From the click that starts a long task: renews now if the token would run out during it. */
  renewBefore(taskMs: number) {
    if (this.token && this.token.expiresAt - EXPIRY_MARGIN_MS - taskMs > Date.now()) return;
    this.signIn();
  }

  /** A valid token, waiting for the user to reconnect if it expired. */
  getToken(): Promise<string> {
    if (this.valid()) return Promise.resolve(this.token!.accessToken);
    if (this.state.status === "signedIn") this.set({ ...this.state, status: "expired" });
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Google rejected the token (401). */
  invalidate() {
    this.token = null;
    write(TOKEN_KEY, null);
  }

  signOut() {
    if (this.token) window.google?.accounts.oauth2.revoke(this.token.accessToken);
    this.invalidate();
    write(EMAIL_KEY, null);
    this.set({ status: "signedOut" });
  }
}

export const auth = new GoogleAuth();

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google sign-in could not be loaded"));
    document.head.appendChild(s);
  });
}
