<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmailSetting extends Model
{
    use HasFactory;

    protected $table = 'email_settings';

    protected $guarded = [];

    protected $casts = [
        'mail_port' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Singleton accessor: get or initialize default email settings record
     */
    public static function current(): self
    {
        return static::firstOrCreate([], [
            'mail_mailer'       => env('MAIL_MAILER', 'smtp'),
            'mail_host'         => env('MAIL_HOST', 'crm.fsadvisory.ae'),
            'mail_port'         => (int) env('MAIL_PORT', 465),
            'mail_scheme'       => env('MAIL_SCHEME', 'smtps'),
            'mail_username'     => env('MAIL_USERNAME', 'notifications@crm.fsadvisory.ae'),
            'mail_password'     => env('MAIL_PASSWORD', 'WHL*tvym@@DM%JyS'),
            'mail_from_address' => env('MAIL_FROM_ADDRESS', 'notifications@crm.fsadvisory.ae'),
            'mail_from_name'    => env('MAIL_FROM_NAME', 'FS Advisory Dubai'),
            'default_domain'    => 'fsadvisory.ae',
            'is_active'         => true,
        ]);
    }

    /**
     * Dynamically inject these settings into Laravel's runtime mail configuration
     */
    public function applyToRuntimeConfig(): void
    {
        config([
            'mail.default' => $this->mail_mailer ?: 'smtp',
            'mail.mailers.smtp.transport' => 'smtp',
            'mail.mailers.smtp.host' => $this->mail_host,
            'mail.mailers.smtp.port' => (int) $this->mail_port,
            'mail.mailers.smtp.scheme' => $this->mail_scheme ?: null,
            'mail.mailers.smtp.username' => $this->mail_username,
            'mail.mailers.smtp.password' => $this->mail_password,
            'mail.from.address' => $this->mail_from_address,
            'mail.from.name' => $this->mail_from_name,
        ]);
    }
}
