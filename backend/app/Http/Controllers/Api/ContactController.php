<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\BuyerQualification;
use App\Models\Activity;
use App\Services\LeadDistributionService;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function index(Request $request)
    {
        // Auto-heal any active duplicate contacts whose counterparts were deleted
        $orphanedDuplicates = Contact::where('state', 'duplicate')->get();
        foreach ($orphanedDuplicates as $dup) {
            static::syncDuplicateStatesForPhone($dup->phone);
            if (!empty($dup->secondary_phone)) {
                static::syncDuplicateStatesForPhone($dup->secondary_phone);
            }
        }

        $tab = $request->get('tab', 'all');

        if ($tab === 'deleted') {
            $query = Contact::onlyTrashed()->with(['opportunities.buyerQualification', 'activities' => function($q) {
                $q->latest()->limit(1);
            }]);
        } else {
            $query = Contact::with(['opportunities.buyerQualification', 'activities' => function($q) {
                $q->latest()->limit(1);
            }]);
        }

        // Apply Tab Filter Logic
        if ($tab === 'unassigned' || $tab === 'new') {
            // Include unassigned leads awaiting allocation (including duplicate inbound leads)
            $query->where(function($q) {
                $q->where(function($sub) {
                    $sub->whereNull('contacts.assigned_to')
                        ->orWhere('contacts.assigned_to', '')
                        ->orWhere('contacts.assigned_to', 'Unassigned');
                })->where(function($sub) {
                    $sub->whereDoesntHave('opportunities')
                        ->orWhereHas('opportunities', function($oppQ) {
                            $oppQ->whereNull('current_owner_name')
                                 ->orWhere('current_owner_name', '')
                                 ->orWhere('current_owner_name', 'Unassigned');
                        });
                });
            });
        } elseif ($tab === 'assigned') {
            $query->where(function($q) {
                $q->where(function($sub) {
                    $sub->whereNotNull('contacts.assigned_to')
                        ->where('contacts.assigned_to', '!=', '')
                        ->where('contacts.assigned_to', '!=', 'Unassigned');
                })->orWhereHas('opportunities', function($oppQ) {
                    $oppQ->whereNotNull('current_owner_name')
                         ->where('current_owner_name', '!=', '')
                         ->where('current_owner_name', '!=', 'Unassigned');
                });
            });
        } elseif ($tab === 'duplicate') {
            $query->where('contacts.state', 'duplicate');
        } elseif ($tab === 'all') {
            // 'all' tab displays all leads (primary and duplicate inquiries)
        }

        // Filter by Inbound Only (non-imported leads: portals, campaign landing pages, webhooks, manual entries)
        if ($request->boolean('inbound_only') || $request->get('source_type') === 'inbound') {
            $query->where('contacts.is_imported', false);
        } elseif ($request->boolean('imported_only') || $request->get('source_type') === 'imported') {
            $query->where('contacts.is_imported', true);
        }

        if ($request->has('state') && !empty($request->state) && $request->state !== 'all') {
            $query->where('contacts.state', $request->state);
        }

        if ($request->has('availability') && !empty($request->availability) && $request->availability !== 'all') {
            if ($request->availability === 'available') {
                $query->where(function($q) {
                    $q->whereDoesntHave('opportunities')
                      ->orWhereHas('opportunities', function($oppQ) {
                          $oppQ->whereNull('current_owner_name')
                               ->orWhere('current_owner_name', '')
                               ->orWhere('current_owner_name', 'Unassigned');
                      });
                });
            } elseif ($request->availability === 'busy') {
                $query->whereHas('opportunities', function($oppQ) {
                    $oppQ->whereNotNull('current_owner_name')
                         ->where('current_owner_name', '!=', '')
                         ->where('current_owner_name', '!=', 'Unassigned');
                });
            }
        }

        // Date Range Calendar filter on contacts.created_at
        if ($request->filled('date_from')) {
            $query->whereDate('contacts.created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('contacts.created_at', '<=', $request->date_to);
        }

        if ($request->has('source') && !empty($request->source) && $request->source !== 'all') {
            $query->where('contacts.source', 'like', "%{$request->source}%");
        }

        if ($request->filled('assigned_owner') && $request->assigned_owner !== 'all') {
            $owner = $request->assigned_owner;
            $query->where(function($q) use ($owner) {
                $q->where('contacts.assigned_to', $owner)
                  ->orWhereHas('opportunities', function($oppQ) use ($owner) {
                      $oppQ->where('current_owner_name', $owner);
                  });
            });
        }

        // SLA Status filter
        if ($request->filled('sla_status') && $request->sla_status !== 'all') {
            $sla = $request->sla_status;
            $query->whereHas('opportunities', function($q) use ($sla) {
                $q->where('sla_status', $sla);
            });
        }

        // Advanced Lead Origin & Channel Source filters
        if ($request->filled('sub_source') && $request->sub_source !== 'all') {
            $sub = $request->sub_source;
            $query->where('contacts.source', 'like', "%{$sub}%");
        }

        // Advanced Opportunity & Property Preferences filters
        $hasOppFilters = ($request->filled('opportunity_type') && $request->opportunity_type !== 'all')
            || ($request->filled('temperature') && $request->temperature !== 'all')
            || ($request->filled('payment_method') && $request->payment_method !== 'all')
            || ($request->filled('developer') && $request->developer !== 'all')
            || ($request->filled('community') && $request->community !== 'all')
            || ($request->filled('project') && $request->project !== 'all')
            || ($request->filled('property_type') && $request->property_type !== 'all')
            || ($request->filled('bedrooms') && $request->bedrooms !== 'all')
            || ($request->filled('project_property') && $request->project_property !== 'all')
            || ($request->filled('budget_min') && is_numeric($request->budget_min))
            || ($request->filled('budget_max') && is_numeric($request->budget_max));

        if ($hasOppFilters) {
            $query->whereHas('opportunities', function($oppQ) use ($request) {
                if ($request->filled('opportunity_type') && $request->opportunity_type !== 'all') {
                    $oppQ->where('opportunity_type', $request->opportunity_type);
                }
                if ($request->filled('temperature') && $request->temperature !== 'all') {
                    $oppQ->where('temperature', $request->temperature);
                }
                if ($request->filled('payment_method') && $request->payment_method !== 'all') {
                    $pm = $request->payment_method;
                    $oppQ->where(function($q) use ($pm) {
                        $q->where('cash_or_finance', $pm)
                          ->orWhereHas('buyerQualification', function($bq) use ($pm) {
                              $bq->where('cash_or_finance', $pm);
                          });
                    });
                }
                if ($request->filled('developer') && $request->developer !== 'all') {
                    $dev = $request->developer;
                    $oppQ->where(function($q) use ($dev) {
                        $q->where('developer', $dev)
                          ->orWhereHas('buyerQualification', function($bq) use ($dev) {
                              $bq->where('developer', $dev);
                          });
                    });
                }
                if ($request->filled('community') && $request->community !== 'all') {
                    $comm = $request->community;
                    $oppQ->where(function($q) use ($comm) {
                        $q->where('community', 'like', "%{$comm}%")
                          ->orWhereHas('buyerQualification', function($bq) use ($comm) {
                              $bq->where('community', 'like', "%{$comm}%");
                          });
                    });
                }
                if ($request->filled('project') && $request->project !== 'all') {
                    $proj = $request->project;
                    $oppQ->where(function($q) use ($proj) {
                        $q->where('project', 'like', "%{$proj}%")
                          ->orWhereHas('buyerQualification', function($bq) use ($proj) {
                              $bq->where('project', 'like', "%{$proj}%");
                          });
                    });
                }
                if ($request->filled('property_type') && $request->property_type !== 'all') {
                    $pt = $request->property_type;
                    $oppQ->where(function($q) use ($pt) {
                        $q->where('project_property', 'like', "%{$pt}%")
                          ->orWhereHas('buyerQualification', function($bq) use ($pt) {
                              $bq->where('property_type', 'like', "%{$pt}%");
                          });
                    });
                }
                if ($request->filled('bedrooms') && $request->bedrooms !== 'all') {
                    $beds = $request->bedrooms;
                    $oppQ->where(function($q) use ($beds) {
                        $q->where('bedrooms', $beds)
                          ->orWhereHas('buyerQualification', function($bq) use ($beds) {
                              $bq->where('bedrooms', $beds);
                          });
                    });
                }
                if ($request->filled('project_property') && $request->project_property !== 'all') {
                    $spec = $request->project_property;
                    $oppQ->where(function($q) use ($spec) {
                        $q->where('project_property', 'like', "%{$spec}%")
                          ->orWhereHas('buyerQualification', function($bq) use ($spec) {
                              $bq->where('project_property', 'like', "%{$spec}%");
                          });
                    });
                }
                if ($request->filled('budget_min') && is_numeric($request->budget_min)) {
                    $oppQ->where(function($q) use ($request) {
                        $q->where('budget_max', '>=', (float) $request->budget_min)
                          ->orWhere('budget_min', '>=', (float) $request->budget_min);
                    });
                }
                if ($request->filled('budget_max') && is_numeric($request->budget_max)) {
                    $oppQ->where(function($q) use ($request) {
                        $q->where('budget_min', '<=', (float) $request->budget_max)
                          ->orWhere('budget_max', '<=', (float) $request->budget_max);
                    });
                }
            });
        }

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('contacts.name', 'like', "%{$search}%")
                  ->orWhere('contacts.phone', 'like', "%{$search}%")
                  ->orWhere('contacts.secondary_phone', 'like', "%{$search}%")
                  ->orWhere('contacts.email', 'like', "%{$search}%");
            });
        }

        $sortBy = $request->get('sort_by', 'updated_at');
        $sortOrder = strtolower($request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';

        $contactSorts = ['name', 'phone', 'secondary_phone', 'email', 'nationality', 'source', 'state', 'created_at', 'updated_at'];
        $oppSorts = [
            'opportunity_type' => 'opportunity_type',
            'developer' => 'developer',
            'community' => 'community',
            'project' => 'project',
            'project_property' => 'project_property',
            'bedrooms' => 'bedrooms',
            'budget_min' => 'budget_min',
            'budget_max' => 'budget_max',
            'cash_or_finance' => 'cash_or_finance',
            'key_requirement' => 'key_requirement',
            'assigned_owner' => 'current_owner_name',
            'next_action' => 'next_action',
            'next_action_due_at' => 'next_action_due_at',
            'sla' => 'sla_status',
            'sla_status' => 'sla_status',
        ];

        if (array_key_exists($sortBy, $oppSorts)) {
            $dbCol = $oppSorts[$sortBy];
            if ($sortBy === 'assigned_owner') {
                $query->orderBy('contacts.assigned_to', $sortOrder);
            } else {
                $query->leftJoin('opportunities', 'contacts.id', '=', 'opportunities.contact_id')
                      ->select('contacts.*')
                      ->distinct()
                      ->orderBy("opportunities.{$dbCol}", $sortOrder);
            }
        } elseif (in_array($sortBy, $contactSorts)) {
            $query->orderBy("contacts.{$sortBy}", $sortOrder);
        } else {
            $query->orderBy("contacts.updated_at", "desc");
        }

        $perPage = (int) $request->get('per_page', 20);
        $contacts = $query->paginate($perPage);

        // Stats calculation for Top KPI Cards & Tab Badge Counts
        $isInboundOnly = $request->boolean('inbound_only') || $request->get('source_type') === 'inbound';
        $baseCountQuery = Contact::query();
        if ($isInboundOnly) {
            $baseCountQuery->where('is_imported', false);
        }

        $unassignedCount = (clone $baseCountQuery)->where(function($q) {
            $q->where(function($sub) {
                $sub->whereNull('assigned_to')
                    ->orWhere('assigned_to', '')
                    ->orWhere('assigned_to', 'Unassigned');
            })->where(function($sub) {
                $sub->whereDoesntHave('opportunities')
                    ->orWhereHas('opportunities', function($oppQ) {
                        $oppQ->whereNull('current_owner_name')
                             ->orWhere('current_owner_name', '')
                             ->orWhere('current_owner_name', 'Unassigned');
                    });
            });
        })->count();

        $assignedCount = (clone $baseCountQuery)->where(function($q) {
            $q->where(function($sub) {
                $sub->whereNotNull('assigned_to')
                    ->where('assigned_to', '!=', '')
                    ->where('assigned_to', '!=', 'Unassigned');
            })->orWhereHas('opportunities', function($oppQ) {
                $oppQ->whereNotNull('current_owner_name')
                     ->where('current_owner_name', '!=', '')
                     ->where('current_owner_name', '!=', 'Unassigned');
            });
        })->count();

        $stats = [
            'total' => (clone $baseCountQuery)->count(),
            'available' => (clone $baseCountQuery)->where('state', 'available')->count(),
            'active' => (clone $baseCountQuery)->where('state', 'active')->count(),
            'reactivation' => (clone $baseCountQuery)->where('state', 'reactivation')->count(),
            'duplicates' => (clone $baseCountQuery)->where('state', 'duplicate')->count(),
            'inbound_total' => Contact::where('is_imported', false)->count(),
            'inbound_unassigned' => Contact::where('is_imported', false)->where(function($q) {
                $q->where(function($sub) {
                    $sub->whereNull('assigned_to')
                        ->orWhere('assigned_to', '')
                        ->orWhere('assigned_to', 'Unassigned');
                })->where(function($sub) {
                    $sub->whereDoesntHave('opportunities')
                        ->orWhereHas('opportunities', function($oppQ) {
                            $oppQ->whereNull('current_owner_name')
                                 ->orWhere('current_owner_name', '')
                                 ->orWhere('current_owner_name', 'Unassigned');
                        });
                });
            })->count(),
            'inbound_portals' => Contact::where('is_imported', false)->where(function($q) {
                $q->where('source', 'like', '%Property Finder%')
                  ->orWhere('source', 'like', '%Bayut%')
                  ->orWhere('source', 'like', '%Dubizzle%');
            })->count(),
            'inbound_campaigns' => Contact::where('is_imported', false)->where(function($q) {
                $q->where('source', 'like', '%Meta%')
                  ->orWhere('source', 'like', '%Facebook%')
                  ->orWhere('source', 'like', '%Google%')
                  ->orWhere('source', 'like', '%Website%')
                  ->orWhereNotNull('utm_source');
            })->count(),
        ];

        $tabCounts = [
            'all' => (clone $baseCountQuery)->count(),
            'unassigned' => $unassignedCount,
            'new' => $unassignedCount,
            'assigned' => $assignedCount,
            'duplicate' => (clone $baseCountQuery)->where('state', 'duplicate')->count(),
            'deleted' => $isInboundOnly ? Contact::onlyTrashed()->where('is_imported', false)->count() : Contact::onlyTrashed()->count(),
        ];

        return response()->json([
            'contacts' => $contacts,
            'stats' => $stats,
            'tab_counts' => $tabCounts,
        ]);
    }

    public function show($id)
    {
        $contact = Contact::with([
            'opportunities.buyerQualification',
            'opportunities.sellerQualification',
            'opportunities.landlordQualification',
            'opportunities.tenantQualification',
            'activities',
        ])->findOrFail($id);

        return response()->json($contact);
    }

    public function store(Request $request)
    {
        // Auto-heal empty or invalid email from external webhooks/ads so leads are never rejected
        if (!$request->filled('email') || !filter_var($request->email, FILTER_VALIDATE_EMAIL)) {
            $nameClean = preg_replace('/[^a-zA-Z0-9]/', '.', strtolower(trim($request->name ?? 'lead')));
            $nameClean = trim($nameClean, '.');
            if (empty($nameClean)) $nameClean = 'lead';
            $phoneClean = preg_replace('/[^0-9]/', '', (string) ($request->phone ?? time()));
            if (empty($phoneClean)) $phoneClean = (string) time();
            $request->merge([
                'email' => "{$nameClean}.{$phoneClean}@fsadvisory-lead.ae"
            ]);
        }

        // Auto-map campaign_url alias to landing_page_url
        if ($request->filled('campaign_url') && !$request->filled('landing_page_url')) {
            $request->merge(['landing_page_url' => $request->campaign_url]);
        }
        if ($request->filled('landing_page_url') && !$request->filled('campaign_url')) {
            $request->merge(['campaign_url' => $request->landing_page_url]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:50',
            'secondary_phone' => 'nullable|string|max:255',
            'email' => 'required|email|max:255',
            'nationality' => 'nullable|string|max:100',
            'emirates_id' => 'nullable|string|max:100',
            'source' => 'nullable|string|max:100',
            'initials' => 'nullable|string|max:10',
            'utm_source' => 'nullable|string|max:255',
            'utm_medium' => 'nullable|string|max:255',
            'utm_campaign' => 'nullable|string|max:255',
            'utm_term' => 'nullable|string|max:255',
            'utm_content' => 'nullable|string|max:255',
            'landing_page_url' => 'nullable|string|max:2048',
            'campaign_url' => 'nullable|string|max:2048',
            'state' => 'nullable|string|max:50',
            // Opportunity & Qualification fields (optional on create)
            'opportunity_type' => 'nullable|string|max:50',
            'temperature' => 'nullable|string|max:50',
            'developer' => 'nullable|string|max:255',
            'community' => 'nullable|string|max:255',
            'project' => 'nullable|string|max:255',
            'project_property' => 'nullable|string|max:255',
            'property_type' => 'nullable|string|max:255',
            'bedrooms' => 'nullable|string|max:50',
            'budget_min' => 'nullable|numeric',
            'budget_max' => 'nullable|numeric',
            'cash_or_finance' => 'nullable|string|max:50',
            'key_requirement' => 'nullable|string|max:1000',
            'next_action' => 'nullable|string|max:500',
            'next_action_due_at' => 'nullable|date',
        ]);

        if (empty($validated['initials'])) {
            $words = explode(' ', $validated['name']);
            $initials = '';
            foreach ($words as $w) {
                $initials .= strtoupper(substr($w, 0, 1));
            }
            $validated['initials'] = substr($initials, 0, 2);
        }

        $validated['source'] = $validated['source'] ?? 'Database';

        // Check if phone or secondary phone already exists in DB
        $existingContact = Contact::where('phone', $validated['phone'])
            ->orWhere(function($q) use ($validated) {
                if (!empty($validated['secondary_phone'])) {
                    $q->where('phone', $validated['secondary_phone'])
                      ->orWhere('secondary_phone', $validated['secondary_phone']);
                }
            })
            ->first();

        $isDuplicate = (bool) $existingContact;
        if (empty($validated['state'])) {
            $validated['state'] = $isDuplicate ? 'duplicate' : 'available';
        }

        $contactData = [
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'secondary_phone' => $validated['secondary_phone'] ?? null,
            'email' => $validated['email'],
            'nationality' => !empty($validated['nationality']) ? $validated['nationality'] : 'Expat / UAE Resident',
            'emirates_id' => $validated['emirates_id'] ?? null,
            'source' => $validated['source'],
            'initials' => $validated['initials'],
            'utm_source' => $validated['utm_source'] ?? null,
            'utm_medium' => $validated['utm_medium'] ?? null,
            'utm_campaign' => $validated['utm_campaign'] ?? null,
            'utm_term' => $validated['utm_term'] ?? null,
            'utm_content' => $validated['utm_content'] ?? null,
            'landing_page_url' => $validated['landing_page_url'] ?? ($validated['campaign_url'] ?? null),
            'is_imported' => false,
            'state' => $validated['state'],
        ];

        $contact = Contact::create($contactData);

        if ($contact->state === 'duplicate') {
            Activity::create([
                'contact_id'  => $contact->id,
                'user_name'   => 'Lead Engine',
                'type'        => 'note',
                'description' => "Duplicate contact created. Matches existing Contact #{$existingContact->id} ({$existingContact->name}, Phone: {$existingContact->phone}). Routed to Duplicate tab.",
            ]);
        } else {
            // Real-Time Lead Distribution: Assign directly if specific advisor explicitly provided
            // Note: Auto-assignment is strictly restricted to batch file imports (ImportController).
            $assignedOwner = $request->input('assigned_owner');
            if (!empty($assignedOwner) && $assignedOwner !== 'auto' && $assignedOwner !== 'Unassigned') {
                $contact->update([
                    'assigned_to' => $assignedOwner,
                    'assigned_at' => now(),
                    'state'       => 'assigned',
                ]);

                Activity::create([
                    'contact_id'  => $contact->id,
                    'user_name'   => 'Lead Engine',
                    'type'        => 'ownership_change',
                    'description' => "Lead assigned to {$assignedOwner} (Awaiting qualification call).",
                ]);
            } else {
                // Not auto-assigned. Kept unassigned/available for review and manual allocation in New Leads
                Activity::create([
                    'contact_id'  => $contact->id,
                    'user_name'   => 'Lead Engine',
                    'type'        => 'note',
                    'description' => "New lead registered and placed in New Leads pool (awaiting assignment).",
                ]);
            }

            // If inquiry preferences were entered during lead registration/inbound webhook, create Opportunity & Qualification specs
            $hasInquirySpecs = $request->filled('developer')
                || $request->filled('community')
                || $request->filled('project')
                || $request->filled('project_property')
                || $request->filled('property_type')
                || $request->filled('bedrooms')
                || $request->filled('budget_min')
                || $request->filled('budget_max')
                || $request->filled('key_requirement')
                || $request->filled('opportunity_type');

            if ($hasInquirySpecs) {
                $opp = Opportunity::create([
                    'contact_id'             => $contact->id,
                    'opportunity_type'       => $request->get('opportunity_type', 'buyer') ?: 'buyer',
                    'stage'                  => 'new',
                    'temperature'            => $request->get('temperature', 'warm') ?: 'warm',
                    'current_owner_name'     => $contact->assigned_to ?: 'Unassigned',
                    'originating_agent_name' => $contact->assigned_to ?: 'Inbound Webhook',
                    'department'             => 'telesales',
                    'budget_min'             => $request->filled('budget_min') ? (float) $request->budget_min : null,
                    'budget_max'             => $request->filled('budget_max') ? (float) $request->budget_max : null,
                    'key_requirement'        => $request->key_requirement ?? ($request->activity_description ?? null),
                    'next_action'            => $request->next_action ?? 'Initial qualification call',
                    'next_action_due_at'     => $request->next_action_due_at ?? now()->addHours(2),
                    'sla_status'             => 'on_track',
                ]);

                BuyerQualification::create([
                    'opportunity_id'       => $opp->id,
                    'community'            => $request->community ?? null,
                    'project'              => $request->project ?? null,
                    'developer'            => $request->developer ?? null,
                    'property_type'        => $request->property_type ?? ($request->project_property ?? null),
                    'bedrooms'             => $request->bedrooms ?? null,
                    'cash_or_finance'      => $request->cash_or_finance ?? 'cash',
                    'qualification_notes'  => $request->key_requirement ?? ($request->activity_description ?? null),
                    'client_intent'        => 'end_user',
                    'purchase_timeline'    => '1-3 months',
                ]);
            }

            $inquiryDetails = [];
            if ($request->filled('developer')) $inquiryDetails[] = "Developer: {$request->developer}";
            if ($request->filled('community')) $inquiryDetails[] = "Location/Community: {$request->community}";
            if ($request->filled('project')) $inquiryDetails[] = "Project: {$request->project}";
            if ($request->filled('project_property')) $inquiryDetails[] = "Unit: {$request->project_property}";
            if ($request->filled('property_type')) $inquiryDetails[] = "Property Type: {$request->property_type}";
            if ($request->filled('bedrooms')) $inquiryDetails[] = "Beds: {$request->bedrooms}";
            if ($request->filled('budget_min') || $request->filled('budget_max')) {
                $inquiryDetails[] = "Budget: AED " . ($request->budget_min ?: '0') . " - " . ($request->budget_max ?: 'Max');
            }
            if ($request->filled('key_requirement')) $inquiryDetails[] = "Notes: {$request->key_requirement}";

            if (!empty($inquiryDetails)) {
                Activity::create([
                    'contact_id'  => $contact->id,
                    'user_name'   => 'Lead Engine',
                    'type'        => 'note',
                    'description' => 'Initial Inquiry Requirements: ' . implode(' | ', $inquiryDetails),
                ]);
            }
        }

        if ($request->filled('activity_description')) {
            Activity::create([
                'contact_id' => $contact->id,
                'user_name' => $request->get('user_name', 'System Agent'),
                'type' => $request->get('activity_type', 'note'),
                'description' => $request->get('activity_description'),
            ]);
        }
        $contact->update(['last_activity_at' => now()]);

        $contact->load(['opportunities.buyerQualification', 'activities']);

        return response()->json($contact, 201);
    }

    public function update(Request $request, $id)
    {
        $contact = Contact::findOrFail($id);

        // Auto-map campaign_url alias to landing_page_url
        if ($request->filled('campaign_url') && !$request->filled('landing_page_url')) {
            $request->merge(['landing_page_url' => $request->campaign_url]);
        }
        if ($request->filled('landing_page_url') && !$request->filled('campaign_url')) {
            $request->merge(['campaign_url' => $request->landing_page_url]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:50',
            'secondary_phone' => 'nullable|string|max:255',
            'email' => 'required|email|max:255',
            'nationality' => 'nullable|string|max:100',
            'emirates_id' => 'nullable|string|max:100',
            'source' => 'nullable|string|max:100',
            'assigned_to' => 'nullable|string|max:100',
            'assigned_owner' => 'nullable|string|max:100',
            'utm_source' => 'nullable|string|max:255',
            'utm_medium' => 'nullable|string|max:255',
            'utm_campaign' => 'nullable|string|max:255',
            'utm_term' => 'nullable|string|max:255',
            'utm_content' => 'nullable|string|max:255',
            'landing_page_url' => 'nullable|string|max:2048',
            'campaign_url' => 'nullable|string|max:2048',
        ]);

        if (isset($validated['campaign_url'])) {
            if (!isset($validated['landing_page_url'])) {
                $validated['landing_page_url'] = $validated['campaign_url'];
            }
            unset($validated['campaign_url']);
        }

        if (!empty($validated['name'])) {
            $words = explode(' ', $validated['name']);
            $initials = '';
            foreach ($words as $w) {
                $initials .= strtoupper(substr($w, 0, 1));
            }
            $validated['initials'] = substr($initials, 0, 2);
        }

        $newOwner = $request->input('assigned_owner') ?? $request->input('assigned_to');
        if (!empty($newOwner) && $newOwner !== 'Unassigned' && $newOwner !== 'auto') {
            $validated['assigned_to'] = $newOwner;
            $validated['assigned_at'] = now();
            $validated['state'] = 'assigned';
        } elseif ($newOwner === 'auto') {
            LeadDistributionService::autoAssignContact($contact);
        }
        unset($validated['assigned_owner']);

        $contact->update($validated);

        Activity::create([
            'contact_id' => $contact->id,
            'user_name' => 'System Agent',
            'type' => 'note',
            'description' => "Updated client contact profile details.",
        ]);

        return response()->json($contact);
    }

    public function destroy($id)
    {
        $contact = Contact::findOrFail($id);
        $phone = $contact->phone;
        $secondary = $contact->secondary_phone;
        $contact->delete();

        if ($phone) static::syncDuplicateStatesForPhone($phone);
        if ($secondary) static::syncDuplicateStatesForPhone($secondary);

        return response()->json(['message' => 'Contact moved to trash successfully.']);
    }

    public function restore($id)
    {
        $contact = Contact::onlyTrashed()->findOrFail($id);
        $phone = $contact->phone;
        $secondary = $contact->secondary_phone;
        $contact->restore();

        if ($phone) static::syncDuplicateStatesForPhone($phone);
        if ($secondary) static::syncDuplicateStatesForPhone($secondary);

        return response()->json(['message' => 'Contact restored successfully.']);
    }

    public function forceDelete($id)
    {
        $contact = Contact::onlyTrashed()->findOrFail($id);
        $phone = $contact->phone;
        $secondary = $contact->secondary_phone;
        $contact->forceDelete();

        if ($phone) static::syncDuplicateStatesForPhone($phone);
        if ($secondary) static::syncDuplicateStatesForPhone($secondary);

        return response()->json(['message' => 'Contact permanently deleted.']);
    }

    public function bulkAssign(Request $request)
    {
        $request->validate([
            'contact_ids' => 'required|array',
            'contact_ids.*' => 'integer',
            'assigned_owner' => 'required|string|max:255',
        ]);

        $ids = $request->input('contact_ids', []);
        $owner = $request->input('assigned_owner');

        if ($owner === 'auto') {
            $contacts = Contact::whereIn('id', $ids)->get();
            $assignedCount = 0;
            foreach ($contacts as $c) {
                $agent = LeadDistributionService::autoAssignContact($c);
                if ($agent) $assignedCount++;
            }
            return response()->json([
                'success' => true,
                'message' => "{$assignedCount} leads auto-distributed across available advisors.",
            ]);
        }

        $opportunities = Opportunity::whereIn('contact_id', $ids)->get();
        foreach ($opportunities as $opp) {
            $opp->update(['current_owner_name' => $owner]);
        }

        Contact::whereIn('id', $ids)->update([
            'assigned_to' => $owner,
            'assigned_at' => now(),
            'state'       => 'assigned',
        ]);

        foreach ($ids as $cid) {
            Activity::create([
                'contact_id'  => $cid,
                'user_name'   => 'Admin',
                'type'        => 'ownership_change',
                'description' => "Lead assigned to {$owner} via bulk assignment (Awaiting qualification call).",
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => count($ids) . " leads successfully assigned to {$owner}.",
        ]);
    }

    public function bulkDelete(Request $request)
    {
        $request->validate([
            'contact_ids' => 'required|array',
            'contact_ids.*' => 'integer',
        ]);

        if ($request->boolean('permanent')) {
            return $this->bulkForceDelete($request);
        }

        $ids = $request->input('contact_ids', []);
        $contacts = Contact::whereIn('id', $ids)->get();
        $phones = [];
        foreach ($contacts as $c) {
            if ($c->phone) $phones[] = $c->phone;
            if ($c->secondary_phone) $phones[] = $c->secondary_phone;
        }

        Contact::whereIn('id', $ids)->delete();

        foreach (array_unique($phones) as $p) {
            static::syncDuplicateStatesForPhone($p);
        }

        return response()->json([
            'success' => true,
            'message' => count($ids) . " leads moved to trash.",
        ]);
    }

    public function bulkRestore(Request $request)
    {
        $request->validate([
            'contact_ids' => 'required|array',
            'contact_ids.*' => 'integer',
        ]);

        $ids = $request->input('contact_ids', []);
        $contacts = Contact::onlyTrashed()->whereIn('id', $ids)->get();
        $phones = [];
        foreach ($contacts as $c) {
            if ($c->phone) $phones[] = $c->phone;
            if ($c->secondary_phone) $phones[] = $c->secondary_phone;
        }

        Contact::onlyTrashed()->whereIn('id', $ids)->restore();

        foreach (array_unique($phones) as $p) {
            static::syncDuplicateStatesForPhone($p);
        }

        return response()->json([
            'success' => true,
            'message' => count($ids) . " leads restored successfully.",
        ]);
    }

    public function bulkForceDelete(Request $request)
    {
        $request->validate([
            'contact_ids' => 'required|array',
            'contact_ids.*' => 'integer',
        ]);

        $ids = $request->input('contact_ids', []);
        $contacts = Contact::withTrashed()->whereIn('id', $ids)->get();
        $phones = [];
        foreach ($contacts as $c) {
            if ($c->phone) $phones[] = $c->phone;
            if ($c->secondary_phone) $phones[] = $c->secondary_phone;
        }

        Contact::withTrashed()->whereIn('id', $ids)->forceDelete();

        foreach (array_unique($phones) as $p) {
            static::syncDuplicateStatesForPhone($p);
        }

        return response()->json([
            'success' => true,
            'message' => count($ids) . " leads permanently deleted.",
        ]);
    }

    /**
     * Synchronize duplicate status for contacts sharing a phone number.
     * If 0 or 1 active contact exists, it cannot be duplicate and is restored to available/assigned.
     * If multiple active contacts exist, the oldest is primary and subsequent ones are marked duplicate.
     */
    public static function syncDuplicateStatesForPhone(?string $phone)
    {
        if (empty($phone)) return;
        $cleanPhone = preg_replace('/[^\d+]/', '', $phone);

        $activeContacts = Contact::where(function($q) use ($phone, $cleanPhone) {
            $q->where('phone', $phone)
              ->orWhere('secondary_phone', $phone);
            if (!empty($cleanPhone) && strlen($cleanPhone) >= 7) {
                $q->orWhereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', '') = ?", [$cleanPhone])
                  ->orWhereRaw("REPLACE(REPLACE(REPLACE(secondary_phone, ' ', ''), '-', ''), '(', '') = ?", [$cleanPhone]);
            }
        })
        ->orderBy('id', 'asc')
        ->get();

        $count = $activeContacts->count();

        if ($count <= 1) {
            // Only 1 (or 0) active contact remains with this phone. It CANNOT be a duplicate.
            foreach ($activeContacts as $c) {
                if ($c->state === 'duplicate') {
                    $newState = (!empty($c->assigned_to) && $c->assigned_to !== 'Unassigned') ? 'assigned' : 'available';
                    $c->update(['state' => $newState]);

                    Activity::create([
                        'contact_id'  => $c->id,
                        'user_name'   => 'Lead Engine',
                        'type'        => 'note',
                        'description' => "Duplicate status automatically cleared. Active counterpart was deleted; lead state restored to '{$newState}'.",
                    ]);
                }
            }
        } else {
            // Multiple active contacts exist.
            // Oldest active contact is primary (available / assigned)
            $primary = $activeContacts->first();
            if ($primary->state === 'duplicate') {
                $primaryState = (!empty($primary->assigned_to) && $primary->assigned_to !== 'Unassigned') ? 'assigned' : 'available';
                $primary->update(['state' => $primaryState]);
            }

            // All subsequent active contacts are marked duplicate
            foreach ($activeContacts->slice(1) as $dup) {
                if ($dup->state !== 'duplicate') {
                    $dup->update(['state' => 'duplicate']);
                }
            }
        }
    }
}
