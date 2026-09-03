<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Opportunity extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'next_action_due_at' => 'datetime',
        'is_orphaned' => 'boolean',
    ];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function buyerQualification()
    {
        return $this->hasOne(BuyerQualification::class);
    }

    public function sellerQualification()
    {
        return $this->hasOne(SellerQualification::class);
    }

    public function landlordQualification()
    {
        return $this->hasOne(LandlordQualification::class);
    }

    public function tenantQualification()
    {
        return $this->hasOne(TenantQualification::class);
    }

    public function activities()
    {
        return $this->hasMany(Activity::class)->latest();
    }

    public function ownershipHistories()
    {
        return $this->hasMany(OwnershipHistory::class)->latest();
    }

    public function slaBreaches()
    {
        return $this->hasMany(SlaBreach::class)->latest();
    }
}
