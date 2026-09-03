<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OwnershipHistory extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }
}
