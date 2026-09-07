<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class CrmTokenAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 1. Extract token from Authorization Bearer header, X-API-KEY header, or X-CRM-TOKEN header
        $token = $request->bearerToken();

        if (!$token) {
            $token = $request->header('X-API-KEY') 
                ?? $request->header('X-CRM-TOKEN') 
                ?? $request->query('api_token');
        }

        if (empty($token)) {
            if (Auth::check()) {
                $user = Auth::user();
                $request->setUserResolver(fn () => $user);
                return $next($request);
            }

            return response()->json([
                'success' => false,
                'error' => 'Unauthorized',
                'message' => 'Authentication failed. Valid Bearer Token or API Key is required to access FS Advisory CRM APIs.',
            ], 401);
        }

        // 2. Check Master API Key (configured in .env CRM_API_KEY)
        $masterKey = config('services.crm.api_key') ?? env('CRM_API_KEY');
        if (!empty($masterKey) && hash_equals($masterKey, $token)) {
            $superAdmin = User::where('role', 'Super Admin')->first() ?? User::first();
            if ($superAdmin) {
                $request->setUserResolver(fn () => $superAdmin);
                Auth::setUser($superAdmin);
            }
            return $next($request);
        }

        // 3. Match against active User api_token or remember_token in database
        $user = User::where('api_token', $token)->where('is_active', true)->first()
            ?? User::where('remember_token', $token)->where('is_active', true)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthorized',
                'message' => 'Invalid or expired API token. Please log in or provide an authorized Bearer token.',
            ], 401);
        }

        // Touch last used timestamp
        $user->update(['api_token_last_used_at' => now()]);

        // Bind user to current request & session
        $request->setUserResolver(fn () => $user);
        Auth::setUser($user);

        return $next($request);
    }
}
