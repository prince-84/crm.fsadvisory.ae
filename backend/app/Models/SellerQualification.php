<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SellerQualification extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'documents_verified' => 'boolean',
        'tenancy_expiry_date' => 'date',
    ];

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }
}
