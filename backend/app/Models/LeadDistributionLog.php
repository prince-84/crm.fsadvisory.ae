<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeadDistributionLog extends Model
{
    use HasFactory;

    protected $table = 'lead_distribution_logs';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
        'record_id' => 'integer',
        'assigned_to_user_id' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }
}
