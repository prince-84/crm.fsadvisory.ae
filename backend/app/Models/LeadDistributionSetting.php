<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeadDistributionSetting extends Model
{
    use HasFactory;

    protected $table = 'lead_distribution_settings';

    protected $guarded = [];

    protected $casts = [
        'is_enabled' => 'boolean',
        'apply_to_lead_pool' => 'boolean',
        'apply_to_lead_import' => 'boolean',
        'apply_to_owner_data' => 'boolean',
        'max_daily_leads_per_agent' => 'integer',
        'last_assigned_user_id' => 'integer',
        'inactivity_reassign_days' => 'integer',
        'recycle_to_pool_days' => 'integer',
        'auto_reassign_idle_leads' => 'boolean',
        'auto_recycle_dormant_leads' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Singleton accessor: get or initialize default settings record
     */
    public static function current(): self
    {
        return static::firstOrCreate([], [
            'is_enabled' => true,
            'distribution_mode' => 'round_robin',
            'apply_to_lead_pool' => true,
            'apply_to_lead_import' => true,
            'apply_to_owner_data' => true,
            'fallback_user_name' => 'Faraz Shafi',
            'max_daily_leads_per_agent' => null,
            'inactivity_reassign_days' => 3,
            'recycle_to_pool_days' => 45,
            'auto_reassign_idle_leads' => true,
            'auto_recycle_dormant_leads' => true,
        ]);
    }
}
