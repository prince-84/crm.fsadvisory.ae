<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BuyerQualification extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'is_first_time_buyer' => 'boolean',
    ];

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }
}
