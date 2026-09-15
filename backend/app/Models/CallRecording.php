<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CallRecording extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'recorded_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function getFormattedDurationAttribute()
    {
        $mins = floor($this->duration_seconds / 60);
        $secs = $this->duration_seconds % 60;
        return sprintf('%02d:%02d', $mins, $secs);
    }

    public function getAudioUrlAttribute($value)
    {
        if (empty($value)) {
            return null;
        }
        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        $clean = ltrim($value, '/');
        // Prepend current app URL if relative
        return url('/' . $clean);
    }
}
