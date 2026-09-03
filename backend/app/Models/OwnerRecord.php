<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class OwnerRecord extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'owner_records';

    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Scope to search across owner name, property name, building, area, and phones
     */
    public function scopeSearch($query, $term)
    {
        if (empty($term)) {
            return $query;
        }

        $term = trim($term);
        return $query->where(function ($q) use ($term) {
            $q->where('owner_name', 'like', "%{$term}%")
              ->orWhere('property_name', 'like', "%{$term}%")
              ->orWhere('building_name', 'like', "%{$term}%")
              ->orWhere('area', 'like', "%{$term}%")
              ->orWhere('property_number', 'like', "%{$term}%")
              ->orWhere('phone_number', 'like', "%{$term}%")
              ->orWhere('mobile_number', 'like', "%{$term}%")
              ->orWhere('email', 'like', "%{$term}%");
        });
    }
}
