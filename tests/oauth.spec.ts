import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizationRequest, exchangeAuthorization, HomeAssistantSession, httpInstance } from '../apps/web/src/app/core/home-assistant/oauth';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const payload=(access='test-access')=>({access_token:access,refresh_token:'test-refresh',token_type:'Bearer',expires_in:1800});
describe('HA OAuth memory session',()=>{
  it('uses a random one-use state and S256 PKCE with same-origin callback',async()=>{
    const first=await authorizationRequest('http://ha.local:8123','http://localhost:4300'),second=await authorizationRequest('http://ha.local:8123','http://localhost:4300'),url=new URL(first.url);
    expect(first.state).not.toBe(second.state);expect(first.verifier).not.toBe(second.verifier);expect(first.verifier).toHaveLength(43);
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4300/auth/callback');expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(first.clientId).toBe('http://localhost:4300/');expect(first.url).not.toContain(first.verifier);
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(first.verifier)));expect(url.searchParams.get('code_challenge')).toBe(Buffer.from(hash).toString('base64url'));
    expect(()=>httpInstance('http://name:password@ha.local')).toThrow();expect(()=>httpInstance('http://ha.local/?token=x')).toThrow();
  });
  it('exchanges a code in a POST body, omits credentials and rejects malformed credentials',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(payload())));vi.stubGlobal('fetch',fetcher);
    const result=await exchangeAuthorization('http://ha.local:8123','http://localhost:4300/','test-code','test-verifier');expect(result.refreshToken).toBe('test-refresh');
    const [url,options]=fetcher.mock.calls[0];expect(url).toBe('http://ha.local:8123/auth/token');expect(options).toMatchObject({method:'POST',credentials:'omit',cache:'no-store',redirect:'error'});expect(Object.fromEntries(options.body)).toEqual({grant_type:'authorization_code',client_id:'http://localhost:4300/',code:'test-code',code_verifier:'test-verifier'});
    fetcher.mockResolvedValue(new Response(JSON.stringify({...payload(),expires_in:NaN})));await expect(exchangeAuthorization('http://ha.local','http://localhost/','code','verifier')).rejects.toThrow('non valida');
  });
  it('renews once for concurrent socket requests and revokes on logout',async()=>{
    vi.useFakeTimers();const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(payload('renewed')))));vi.stubGlobal('fetch',fetcher);const expired=vi.fn();
    const session=new HomeAssistantSession('http://ha.local','http://localhost/',{accessToken:'old',refreshToken:'test-refresh',expiresAt:Date.now()+1000},expired);
    expect(await Promise.all([session.accessToken(),session.accessToken()])).toEqual(['renewed','renewed']);expect(fetcher).toHaveBeenCalledTimes(1);expect(Object.fromEntries(fetcher.mock.calls[0][1].body)).toMatchObject({grant_type:'refresh_token',refresh_token:'test-refresh'});
    await vi.advanceTimersByTimeAsync(1741000);expect(fetcher).toHaveBeenCalledTimes(2);await session.close();expect(fetcher.mock.calls[2][0]).toBe('http://ha.local/auth/revoke');expect(Object.fromEntries(fetcher.mock.calls[2][1].body)).toEqual({token:'test-refresh'});await expect(session.accessToken()).rejects.toThrow('terminata');expect(expired).not.toHaveBeenCalled();
  });
  it('clears a rejected session and prevents late refresh from reviving logout',async()=>{
    vi.useFakeTimers();let resolve!:(response:Response)=>void;const fetcher=vi.fn().mockImplementation((url:string)=>url.endsWith('/revoke')?Promise.resolve(new Response('')):new Promise<Response>(r=>resolve=r));vi.stubGlobal('fetch',fetcher);const expired=vi.fn();
    const session=new HomeAssistantSession('http://ha.local','http://localhost/',{accessToken:'old',refreshToken:'test-refresh',expiresAt:Date.now()+1000},expired),pending=session.accessToken();await session.close();resolve(new Response(JSON.stringify(payload())));await expect(pending).rejects.toThrow('scaduta');await expect(session.accessToken()).rejects.toThrow('terminata');expect(expired).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(new Response('',{status:403}));const rejected=new HomeAssistantSession('http://ha.local','http://localhost/',{accessToken:'old',refreshToken:'test-refresh',expiresAt:Date.now()+1000},expired);await expect(rejected.accessToken()).rejects.toThrow('scaduta');expect(expired).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(100000);expect(expired).toHaveBeenCalledTimes(1);
  });
});
