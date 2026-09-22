<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TableColumnSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'table_name',
        'visibility',
        'order',
        'updated_by',
    ];

    protected $casts = [
        'visibility' => 'array',
        'order' => 'array',
    ];
}
