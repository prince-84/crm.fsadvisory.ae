<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\LeadSource;
use App\Models\LeadSubSource;

class LeadSourceSeeder extends Seeder
{
    public function run(): void
    {
        $sourcesData = [
            [
                'name' => 'Meta Ads & Social Media',
                'sort_order' => 1,
                'sub_sources' => [
                    'Facebook',
                    'Facebook - Binghatti',
                    'Facebook - Binghatti Open House',
                    'Facebook - Open Channel 6',
                    'Social Media',
                    'TikTok',
                    'Instagram Ads',
                ]
            ],
            [
                'name' => 'Google Ads',
                'sort_order' => 2,
                'sub_sources' => [
                    'Google Advertisment',
                    'PPC Search Campaign',
                    'Display Network',
                ]
            ],
            [
                'name' => 'Property Finder',
                'sort_order' => 3,
                'sub_sources' => [
                    'Propertyfinder Call',
                    'Propertyfinder email',
                    'Propertyfinder whatsapp',
                ]
            ],
            [
                'name' => 'Bayut',
                'sort_order' => 4,
                'sub_sources' => [
                    'Bayut Call',
                    'Bayut Email',
                    'Bayut WhatsApp',
                ]
            ],
            [
                'name' => 'Dubizzle',
                'sort_order' => 5,
                'sub_sources' => [
                    'Dubizzle Call',
                    'Dubizzle Email',
                    'Dubizzle WhatsApp',
                ]
            ],
            [
                'name' => 'WhatsApp Marketing',
                'sort_order' => 6,
                'sub_sources' => [
                    'Whatsapp Lead',
                    'Whatsapp Campaign Lead',
                    'Whatsapp 971543939047',
                    'WAZZUP: WhatsApp - Open Channel 2',
                ]
            ],
            [
                'name' => 'Websites & Landing Pages',
                'sort_order' => 7,
                'sub_sources' => [
                    'Website',
                    'WEB',
                    'Project Website',
                    'Community Website',
                    'salwaproperties.com',
                    'promotions.salwaproperties.com',
                    'apartments-dubai.com',
                    'offplan360.com',
                    'one-b-tower.apartments-dubai.com',
                    'palm-jabel-ali.com',
                    'palmjabelali.net',
                    'park-edges.com',
                    'tilalalghaf.community',
                    'uae-offplan.com',
                    'uae-offplan',
                ]
            ],
            [
                'name' => 'Direct & Referrals',
                'sort_order' => 8,
                'sub_sources' => [
                    'Call',
                    'Referal',
                    'Walk-in',
                    'Leads Bank',
                    'Database',
                ]
            ],
        ];

        foreach ($sourcesData as $srcItem) {
            $source = LeadSource::firstOrCreate(
                ['name' => $srcItem['name']],
                ['is_active' => true, 'sort_order' => $srcItem['sort_order']]
            );

            foreach ($srcItem['sub_sources'] as $subIdx => $subName) {
                LeadSubSource::firstOrCreate(
                    ['lead_source_id' => $source->id, 'name' => $subName],
                    ['is_active' => true, 'sort_order' => $subIdx + 1]
                );
            }
        }
    }
}
