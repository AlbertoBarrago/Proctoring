<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Cors
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $headers = [
            'paths' => ['api/*'],
            'allowed_methods' => ['*'],
            'allowed_origins' => ['http://localhost:4200'],
            'allowed_origins_patterns' => [],
            'allowed_headers' => ['*'],
            'exposed_headers' => [],
            'max_age' => 0,
            'supports_credentials' => false,
        ];

        if ($request->isMethod('OPTIONS')) {
            return response('', 204)->withHeaders($headers);
        }

        $response = $next($request);

        foreach ($headers as $key => $value) {
            $response->header($key, $value);
        }

        return $response;
    }
}
