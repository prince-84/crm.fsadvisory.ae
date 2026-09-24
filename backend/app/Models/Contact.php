<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contact extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'last_activity_at' => 'datetime',
        'assigned_at' => 'datetime',
        'next_action_due_at' => 'datetime',
        'is_imported' => 'boolean',
    ];

    protected $appends = [
        'campaign_url',
        'inquiry_specs',
        'sub_source',
        'is_contacted',
        'latest_call_outcome',
    ];

    public function getLatestCallOutcomeAttribute()
    {
        if ($this->relationLoaded('activities')) {
            $call = $this->activities->first(function ($act) {
                return $act->type === 'call' || !empty($act->call_outcome);
            });
            if ($call && !empty($call->call_outcome)) return $call->call_outcome;
        }

        if ($this->relationLoaded('opportunities')) {
            foreach ($this->opportunities as $opp) {
                if ($opp->relationLoaded('activities')) {
                    $call = $opp->activities->first(function ($act) {
                        return $act->type === 'call' || !empty($act->call_outcome);
                    });
                    if ($call && !empty($call->call_outcome)) return $call->call_outcome;
                }
            }
        }

        return null;
    }

    public function getIsContactedAttribute()
    {
        if ($this->relationLoaded('activities')) {
            $hasCall = $this->activities->contains(function ($act) {
                return $act->type === 'call' || !empty($act->call_outcome);
            });
            if ($hasCall) return true;
        }

        if ($this->relationLoaded('opportunities')) {
            foreach ($this->opportunities as $opp) {
                if ($opp->relationLoaded('activities')) {
                    if ($opp->activities->contains(function ($act) {
                        return $act->type === 'call' || !empty($act->call_outcome);
                    })) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public function getCampaignUrlAttribute()
    {
        return $this->landing_page_url;
    }

    public function getSubSourceAttribute()
    {
        if (preg_match('/\((.*?)\)/', $this->source ?? '', $matches)) {
            return trim($matches[1]);
        }
        return $this->utm_source ?? null;
    }

    public function getInquirySpecsAttribute()
    {
        $note = null;
        if ($this->relationLoaded('activities')) {
            $note = $this->activities->first(function ($act) {
                $desc = $act->description ?? '';
                return str_contains($desc, 'Initial Inquiry Requirements:') || str_contains($desc, 'Initial Inquiry Details:') || str_contains($desc, 'Initial Inquiry');
            });
        }

        if (!$note) {
            $note = $this->activities()->where(function($q) {
                $q->where('description', 'like', '%Initial Inquiry Requirements:%')
                  ->orWhere('description', 'like', '%Initial Inquiry Details:%')
                  ->orWhere('description', 'like', '%Initial Inquiry%');
            })->latest()->first();
        }

        if (!$note) return (object) [];

        $desc = $note->description ?? '';
        $specs = [];
        if (preg_match('/(?:Developer|Dev):\s*([^|]+)/i', $desc, $m)) $specs['developer'] = trim($m[1]);
        if (preg_match('/(?:Location\/Community|Community|Area):\s*([^|]+)/i', $desc, $m)) $specs['community'] = trim($m[1]);
        if (preg_match('/Project:\s*([^|]+)/i', $desc, $m)) $specs['project'] = trim($m[1]);
        if (preg_match('/(?:Unit|Prop):\s*([^|]+)/i', $desc, $m)) $specs['project_property'] = trim($m[1]);
        if (preg_match('/(?:Property Type|Type):\s*([^|]+)/i', $desc, $m)) $specs['property_type'] = trim($m[1]);
        if (preg_match('/Beds?(?:rooms)?:\s*([^|]+)/i', $desc, $m)) $specs['bedrooms'] = trim($m[1]);
        if (preg_match('/Budget:\s*(?:AED\s*)?([0-9,]+)\s*(?:–|-)\s*([0-9,]+|Max)/i', $desc, $m)) {
            $specs['budget_min'] = (float) str_replace(',', '', $m[1]);
            if ($m[2] !== 'Max') $specs['budget_max'] = (float) str_replace(',', '', $m[2]);
        }
        if (preg_match('/Notes:\s*(.*?)(?=\s*\|(?:Developer|Dev|Location\/Community|Community|Area|Project|Unit|Prop|Property Type|Type|Beds|Budget):|$)/is', $desc, $m)) {
            $specs['key_requirement'] = trim($m[1]);
        } elseif (preg_match('/Notes:\s*([^|]+)/i', $desc, $m)) {
            $specs['key_requirement'] = trim($m[1]);
        }

        return (object) $specs;
    }

    public function opportunities()
    {
        return $this->hasMany(Opportunity::class);
    }

    public function opportunity()
    {
        return $this->hasOne(Opportunity::class)->latestOfMany();
    }

    public function activeOpportunity()
    {
        return $this->hasOne(Opportunity::class)->whereNotIn('stage', ['closed_won', 'closed_lost'])->latestOfMany();
    }

    public function activities()
    {
        return $this->hasMany(Activity::class)->latest();
    }
}
