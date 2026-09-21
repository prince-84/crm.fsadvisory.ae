<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table) {
                $table->id();
                $table->string('name', 100)->unique();
                $table->string('code', 50)->nullable();
                $table->string('description', 255)->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });

            // Seed initial departments
            $initialDepts = [
                ['name' => 'Sales', 'code' => 'SALES', 'description' => 'Property Sales & Advisory Consultants', 'created_at' => now(), 'updated_at' => now()],
                ['name' => 'Telesales', 'code' => 'TELESALES', 'description' => 'Inbound Lead Qualification & Telesales Desk', 'created_at' => now(), 'updated_at' => now()],
                ['name' => 'Executive Management', 'code' => 'EXEC', 'description' => 'Founders, Directors, and Executive Officers', 'created_at' => now(), 'updated_at' => now()],
                ['name' => 'Operations', 'code' => 'OPS', 'description' => 'CRM Operations, Admin, & Quality Control', 'created_at' => now(), 'updated_at' => now()],
                ['name' => 'Marketing', 'code' => 'MKT', 'description' => 'Digital Marketing, Campaigns, & Lead Gen', 'created_at' => now(), 'updated_at' => now()],
                ['name' => 'Property Management', 'code' => 'PROP_MGMT', 'description' => 'Leasing, Landlord & Tenant Relations', 'created_at' => now(), 'updated_at' => now()],
            ];

            foreach ($initialDepts as $dept) {
                DB::table('departments')->updateOrInsert(['name' => $dept['name']], $dept);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('departments');
    }
};
