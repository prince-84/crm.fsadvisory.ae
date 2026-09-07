<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contact extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'last_activity_at' => 'datetime',
        'assigned_at' => 'datetime',
        'is_imported' => 'boolean',
    ];

    public function opportunities()
    {
        return $this->hasMany(Opportunity::class);
    }

    public function opportunity()
    {
        return $this->hasOne(Opportunity::class)->latestOfMany();
    }

    public function activeOpportunity()
    {
        return $this->hasOne(Opportunity::class)->whereNotIn('stage', ['closed_won', 'closed_lost'])->latestOfMany();
    }

    public function activities()
    {
        return $this->hasMany(Activity::class)->latest();
    }
}
