import type { User } from 'firebase/auth';

export type Service = { id: string; name: string; duration: number };
export type Availability = { services: Service[]; service: string; first: string; last: string; times: Record<string, string[]> };

const api = (process.env.EXPO_PUBLIC_NAIL_STUDIO_API || 'https://bol-o-rouge.vercel.app') + '/api/agenda-unhas';

export async function request<T>(query: URLSearchParams, user?: User | null, method = 'GET', body?: object): Promise<T> {
  const headers: Record<string, string> = {};
  if (user) headers.Authorization = 'Bearer ' + await user.getIdToken();
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(api + '?' + query.toString(), { method, headers, body: body && JSON.stringify(body) });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Agenda temporariamente indisponível.');
  }
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível acessar a agenda.'), { status: response.status });
  return data;
}
