<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OwnerCategory extends Model
{
    use HasFactory;

    protected $table = 'owner_categories';

    protected $guarded = [];
}
