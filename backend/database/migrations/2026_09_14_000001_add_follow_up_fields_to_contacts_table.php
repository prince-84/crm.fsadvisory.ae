<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            if (!Schema::hasColumn('contacts', 'next_action')) {
                $table->string('next_action')->nullable()->after('state');
            }
            if (!Schema::hasColumn('contacts', 'next_action_due_at')) {
                $table->dateTime('next_action_due_at')->nullable()->after('next_action');
            }
            if (!Schema::hasColumn('contacts', 'sla_status')) {
                $table->string('sla_status')->default('on_track')->after('next_action_due_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('contacts', 'sla_status')) {
                $cols[] = 'sla_status';
            }
            if (Schema::hasColumn('contacts', 'next_action_due_at')) {
                $cols[] = 'next_action_due_at';
            }
            if (Schema::hasColumn('contacts', 'next_action')) {
                $cols[] = 'next_action';
            }
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
