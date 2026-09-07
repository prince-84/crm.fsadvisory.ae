<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('email_settings', function (Blueprint $table) {
            $table->id();
            $table->string('mail_mailer')->default('smtp');
            $table->string('mail_host')->default('crm.fsadvisory.ae');
            $table->integer('mail_port')->default(465);
            $table->string('mail_scheme')->nullable()->default('smtps'); // smtps, tls, ssl, null
            $table->string('mail_username')->default('notifications@crm.fsadvisory.ae');
            $table->text('mail_password')->nullable();
            $table->string('mail_from_address')->default('notifications@crm.fsadvisory.ae');
            $table->string('mail_from_name')->default('FS Advisory Dubai');
            $table->string('default_domain')->default('fsadvisory.ae');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_settings');
    }
};
