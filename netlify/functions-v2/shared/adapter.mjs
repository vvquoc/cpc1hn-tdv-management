export function adapt(handler) {
  return async function netlifyFunction(request, context) {
    const url = new URL(request.url);
    const event = {
      httpMethod: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method === "GET" || request.method === "HEAD" ? null : await request.text(),
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams.entries())
    };
    const result = await handler(event, context);
    return new Response(result.body || "", {
      status: result.statusCode || 200,
      headers: result.headers || {}
    });
  };
}
