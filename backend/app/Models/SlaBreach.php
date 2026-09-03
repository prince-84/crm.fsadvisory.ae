<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SlaBreach extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'breached_at' => 'datetime',
        'reassigned_to_manager' => 'boolean',
    ];

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }
}
