export interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1ApiResponse {
  result: D1Result[];
  success: boolean;
  errors: unknown[];
}
interface D2ApiResponse {
  result: D1Result[];
  success: boolean;
  errors: unknown[];
}

export class D1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor() {
    this.accountId  = process.env.CLOUDFLARE_ACCOUNT_ID!;
    this.databaseId = process.env.CLOUDFLARE_INDEX_DATABASE_ID!;
    this.apiToken   = process.env.CLOUDFLARE_API_TOKEN!;
    this.baseUrl    = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;

    if (!this.accountId || !this.databaseId || !this.apiToken) {
      throw new Error('Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_INDEX_DATABASE_ID, or CLOUDFLARE_API_TOKEN');
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<D1Result> {
    const body =
      params.length > 0 ? { sql, params } : { sql };

    const json = await this.requestQuery<D1ApiResponse>(body);

    if (!json.success) {
      throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
    }

    return json.result[0];
  }

  async batch(statements: { sql: string; params?: unknown[] }[]): Promise<D1Result[]> {
    if (statements.length === 0) return [];
    const batch = statements.map(({ sql, params }) =>
      params !== undefined && params.length > 0 ? { sql, params } : { sql },
    );
    const json = await this.requestQuery<D1ApiResponse>({ batch });

    if (!json.success) {
      throw new Error(`D1 batch error: ${JSON.stringify(json.errors)}`);
    }

    return json.result;
  }

  async exec(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await this.query(statement);
    }
  }

  private async requestQuery<T>(payload: unknown): Promise<T> {
    const response = await this.sendQuery(payload);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`D1 request failed: ${response.status} ${text}`);
    }

    return await response.json() as T;
  }
  private async sendQuery(payload: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
export class D2Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor() {
    this.accountId  = process.env.CLOUDFLARE_ACCOUNT_ID!;
    this.databaseId = process.env.CLOUDFLARE_ARTICLES_DATABASE_ID!;
    this.apiToken   = process.env.CLOUDFLARE_API_TOKEN!;
    this.baseUrl    = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;
    if (!this.accountId || !this.databaseId || !this.apiToken) {
      throw new Error('Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ARTICLES_DATABASE_ID, or CLOUDFLARE_API_TOKEN');
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<D1Result> {
    const body =
      params.length > 0 ? { sql, params } : { sql };

    const json = await this.requestQuery<D1ApiResponse>(body);

    if (!json.success) {
      throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
    }

    return json.result[0];
  }

  async batch(statements: { sql: string; params?: unknown[] }[]): Promise<D1Result[]> {
    if (statements.length === 0) return [];
    const batch = statements.map(({ sql, params }) =>
      params !== undefined && params.length > 0 ? { sql, params } : { sql },
    );
    const json = await this.requestQuery<D1ApiResponse>({ batch });

    if (!json.success) {
      throw new Error(`D1 batch error: ${JSON.stringify(json.errors)}`);
    }

    return json.result;
  }

  async exec(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await this.query(statement);
    }
  }

  private async requestQuery<T>(payload: unknown): Promise<T> {
    const response = await this.sendQuery(payload);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`D1 request failed: ${response.status} ${text}`);
    }

    return await response.json() as T;
  }
  private async sendQuery(payload: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
