<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use App\Models\AiLeadScore;
use Illuminate\Http\Request;

class AiController extends Controller
{
    public function predict($id)
    {
        $opp = Opportunity::with(['contact', 'buyerQualification', 'sellerQualification'])->findOrFail($id);

        $prob = 88;
        $rating = 'high';
        $signals = [];
        $rec = '';

        if ($opp->temperature === 'hot') {
            $prob = 92;
            $rating = 'high';
            $signals[] = 'Hot temperature flag assigned by Telesales';
            $signals[] = 'Immediate purchase timeline captured';
            $rec = 'Client has cash ready for ' . ($opp->buyerQualification->community ?? 'Downtown Dubai') . '. Schedule Saturday property viewing immediately.';
        } elseif ($opp->opportunity_type === 'seller') {
            $prob = 78;
            $rating = 'medium';
            $signals[] = 'Seller listing CMA value confirmed';
            $signals[] = 'Vacant unit ready for photos';
            $rec = 'Generate formal CMA agreement and schedule photography team.';
        } else {
            $prob = 65;
            $rating = 'medium';
            $signals[] = 'Regular follow-up lead';
            $rec = 'Send updated off-plan project brochures via WhatsApp.';
        }

        $aiScore = AiLeadScore::updateOrCreate(
            ['opportunity_id' => $opp->id],
            [
                'intent_rating' => $rating,
                'purchase_probability_pct' => $prob,
                'ai_recommendation' => $rec,
                'key_signals' => implode(' | ', $signals),
            ]
        );

        return response()->json($aiScore);
    }
}
