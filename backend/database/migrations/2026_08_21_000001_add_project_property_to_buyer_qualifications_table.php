<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('buyer_qualifications', function (Blueprint $table) {
            if (!Schema::hasColumn('buyer_qualifications', 'project_property')) {
                $table->string('project_property')->nullable()->after('project');
            }
        });
    }

    public function down(): void
    {
        Schema::table('buyer_qualifications', function (Blueprint $table) {
            if (Schema::hasColumn('buyer_qualifications', 'project_property')) {
                $table->dropColumn('project_property');
            }
        });
    }
};
