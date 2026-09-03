<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TenantQualification extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'move_in_date' => 'date',
    ];

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }
}
