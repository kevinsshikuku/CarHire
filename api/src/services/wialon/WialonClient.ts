export type WialonUnitPosition = {
  y: number; // latitude
  x: number; // longitude
  s?: number; // speed
  c?: number; // course
  t: number; // unix time (seconds)
};

export type WialonUnit = {
  id: number;
  nm: string;
  pos?: WialonUnitPosition;
};

type WialonTokenLoginResponse = {
  eid: string;
};

type WialonSearchItemsResponse = {
  items?: WialonUnit[];
};

export class WialonClient {
  private ajaxUrl: string;

  constructor(opts: { baseUrl: string }) {
    const trimmed = opts.baseUrl.replace(/\/$/, '');
    this.ajaxUrl = trimmed.endsWith('/wialon/ajax.html') ? trimmed : `${trimmed}/wialon/ajax.html`;
  }

  private async call<T>(input: { svc: string; params: unknown; sid?: string }): Promise<T> {
    const url = new URL(this.ajaxUrl);
    url.searchParams.set('svc', input.svc);
    url.searchParams.set('params', JSON.stringify(input.params));
    if (input.sid) url.searchParams.set('sid', input.sid);

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Wialon API error ${res.status} ${res.statusText}: ${body}`);
    }
    const json = (await res.json()) as any;
    if (json?.error) {
      throw new Error(`Wialon API error code ${json.error}`);
    }
    return json as T;
  }

  async tokenLogin(token: string): Promise<WialonTokenLoginResponse> {
    return await this.call<WialonTokenLoginResponse>({
      svc: 'token/login',
      params: { token }
    });
  }

  async searchUnitsWithLastPosition(eid: string): Promise<WialonUnit[]> {
    const resp = await this.call<WialonSearchItemsResponse>({
      svc: 'core/search_items',
      sid: eid,
      params: {
        spec: {
          itemsType: 'avl_unit',
          propName: 'sys_name',
          propValueMask: '*',
          sortType: 'sys_name'
        },
        force: 1,
        flags: 1025,
        from: 0,
        to: 0
      }
    });
    return resp.items ?? [];
  }
}

