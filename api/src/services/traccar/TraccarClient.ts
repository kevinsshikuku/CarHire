export type TraccarDevice = {
  id: number;
  name: string;
  uniqueId: string;
};

export type TraccarPosition = {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed?: number;
  course?: number;
  accuracy?: number;
  serverTime: string;
  fixTime?: string;
  deviceTime?: string;
  attributes?: Record<string, unknown>;
};

export class TraccarClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(opts: { baseUrl: string; username: string; password: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    const token = Buffer.from(`${opts.username}:${opts.password}`).toString('base64');
    this.authHeader = `Basic ${token}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {})
      }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Traccar API error ${res.status} ${res.statusText}: ${body}`);
    }

    // Traccar sometimes returns empty body on POST
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      // @ts-expect-error allow void
      return undefined;
    }
    return (await res.json()) as T;
  }

  async createDevice(input: { name: string; uniqueId: string }): Promise<TraccarDevice> {
    return await this.request<TraccarDevice>('/devices', {
      method: 'POST',
      body: JSON.stringify({ name: input.name, uniqueId: input.uniqueId })
    });
  }

  async getPositions(input: { deviceId?: number; from: Date; to: Date }): Promise<TraccarPosition[]> {
    const params = new URLSearchParams();
    if (input.deviceId != null) params.set('deviceId', String(input.deviceId));
    params.set('from', input.from.toISOString());
    params.set('to', input.to.toISOString());
    return await this.request<TraccarPosition[]>(`/positions?${params.toString()}`, { method: 'GET' });
  }
}

