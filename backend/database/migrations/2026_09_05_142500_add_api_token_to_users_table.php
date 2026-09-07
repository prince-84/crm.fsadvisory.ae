<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'api_token')) {
                $table->string('api_token', 80)->nullable()->unique()->after('password');
            }
            if (!Schema::hasColumn('users', 'api_token_last_used_at')) {
                $table->timestamp('api_token_last_used_at')->nullable()->after('api_token');
            }
        });

        // Generate tokens for existing users
        $users = DB::table('users')->get();
        foreach ($users as $user) {
            $prefix = ($user->id === 1 || strtolower($user->role) === 'super admin') ? 'fsa_admin_' : 'fsa_token_';
            $token = $prefix . Str::random(50);
            DB::table('users')->where('id', $user->id)->update([
                'api_token' => $token,
                'api_token_last_used_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'api_token_last_used_at')) {
                $table->dropColumn('api_token_last_used_at');
            }
            if (Schema::hasColumn('users', 'api_token')) {
                $table->dropColumn('api_token');
            }
        });
    }
};
