<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\LeadDistributionService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('crm:process-idle-leads', function () {
    $this->info('Starting lead inactivity check (3-day rotation) and dormancy check (45-day recycling to Lead Pool)...');
    $result = LeadDistributionService::processIdleAndDormantLeads();
    $this->info("Completed successfully:");
    $this->line(" - Reassigned/Rotated: {$result['reassigned_count']} leads");
    $this->line(" - Recycled to Lead Pool: {$result['recycled_count']} leads");
    foreach ($result['reassigned'] as $r) {
        $this->line("   * Rotated #{$r['id']} ({$r['name']}): {$r['from_owner']} -> {$r['to_owner']} ({$r['days_inactive']} days idle)");
    }
    foreach ($result['recycled'] as $c) {
        $this->line("   * Recycled #{$c['id']} ({$c['name']}) back to Lead Pool from {$c['previous_owner']} ({$c['dormant_days']} days dormant)");
    }
})->purpose('Auto-reassign idle leads (3+ days) and recycle dormant leads (45+ days) back to Lead Pool');

Schedule::command('crm:process-idle-leads')->hourly();

