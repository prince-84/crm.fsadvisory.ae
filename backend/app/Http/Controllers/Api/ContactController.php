<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\BuyerQualification;
use App\Models\Activity;
use App\Services\LeadDistributionService;
use Illuminate\Http\Request;
use Carbon\Carbon;

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
            $query = Contact::onlyTrashed()->with([
                'opportunities.buyerQualification',
                'opportunities.activities' => function($q) {
                    $q->where('type', 'call')->latest()->limit(1);
                },
                'activities' => function($q) {
                    $q->latest()->limit(5);
                }
            ])->withCount('opportunities');
        } else {
            $query = Contact::with([
                'opportunities.buyerQualification',
                'opportunities.activities' => function($q) {
                    $q->where('type', 'call')->latest()->limit(1);
                },
                'activities' => function($q) {
                    $q->latest()->limit(5);
                }
            ])->withCount('opportunities');
        }

        // Apply Tab Filter Logic
        if ($tab === 'unassigned') {
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
        } elseif ($tab === 'new' || $tab === 'uncontacted') {
            // New / Uncontacted: Leads that have not been called yet
            if (!$request->boolean('leads_desk') && !$request->boolean('imported_only')) {
                $query->where('contacts.is_imported', false);
            }
            $query->whereDoesntHave('activities', function($actQ) {
                $actQ->where('type', 'call');
            })->whereDoesntHave('opportunities.activities', function($actQ) {
                $actQ->where('type', 'call');
            });
        } elseif ($tab === 'contacted') {
            // Contacted: At least 1 call activity logged
            $query->where(function($q) {
                $q->whereHas('activities', function($actQ) {
                    $actQ->where('type', 'call');
                })->orWhereHas('opportunities.activities', function($actQ) {
                    $actQ->where('type', 'call');
                });
            });
        } elseif ($tab === 'overdue') {
            $query->where(function($q) {
                $q->where(function($cq) {
                    $cq->where('contacts.sla_status', 'overdue')
                       ->orWhere(function($sub) {
                           $sub->whereNotNull('contacts.next_action_due_at')
                               ->where('contacts.next_action_due_at', '<', now());
                       });
                })->orWhereHas('opportunities', function($oppQ) {
                    $oppQ->where('sla_status', 'overdue')
                         ->orWhere(function($sub) {
                             $sub->whereNotNull('next_action_due_at')
                                 ->where('next_action_due_at', '<', now());
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
        } elseif ($tab === 'opportunities' || $tab === 'opp_quickview') {
            $query->whereHas('opportunities');
        } elseif ($tab === 'all') {
            // 'all' tab displays all leads (primary and duplicate inquiries)
        }

        // Filter by Leads Desk, Inbound Only, or Imported Only
        if ($request->boolean('leads_desk')) {
            // Leads Desk shows: all live inbound leads + any imported leads that have been assigned to an advisor
            $query->where(function ($q) {
                $q->where('contacts.is_imported', false)
                  ->orWhereNull('contacts.is_imported')
                  ->orWhere(function ($sub) {
                      $sub->where('contacts.is_imported', true)
                          ->whereNotNull('contacts.assigned_to')
                          ->where('contacts.assigned_to', '!=', '')
                          ->where('contacts.assigned_to', '!=', 'Unassigned');
                  });
            });
        } elseif ($request->boolean('inbound_only') || $request->get('source_type') === 'inbound') {
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

        $authUser = $request->user();
        $canViewAllLeads = $authUser && (
            strtolower($authUser->role ?? '') === 'super admin' ||
            strtolower($authUser->role ?? '') === 'sales manager' ||
            strtolower($authUser->role ?? '') === 'operations coordinator' ||
            $authUser->id === 1 ||
            $authUser->hasPermission('*') ||
            $authUser->hasPermission('leads.view_all')
        );

        $targetOwner = null;
        if (!$canViewAllLeads) {
            // Standard agent / advisor: Strictly locked to their own assigned leads
            $targetOwner = $authUser ? $authUser->name : 'Unassigned';
        } elseif ($request->filled('assigned_owner') && $request->assigned_owner !== 'all') {
            // Super Admin or Sales Manager explicitly filtering by an advisor
            $targetOwner = $request->assigned_owner;
        }

        if ($targetOwner !== null) {
            if ($targetOwner === 'unassigned') {
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
            } else {
                $query->where(function($q) use ($targetOwner) {
                    $q->where('contacts.assigned_to', $targetOwner)
                      ->orWhereHas('opportunities', function($oppQ) use ($targetOwner) {
                          $oppQ->where('current_owner_name', $targetOwner);
                      });
                });
            }
        }

        // SLA Status filter
        if ($request->filled('sla_status') && $request->sla_status !== 'all') {
            $sla = $request->sla_status;
            $query->where(function($q) use ($sla) {
                $q->where('contacts.sla_status', $sla)
                  ->orWhereHas('opportunities', function($oppQ) use ($sla) {
                      $oppQ->where('sla_status', $sla);
                  });
            });
        }

        // Pipeline Stage filter
        if ($request->filled('stage') && $request->stage !== 'all') {
            if ($request->stage === 'no_deal') {
                $query->whereDoesntHave('opportunities', function($oppQ) {
                    $oppQ->whereNotIn('stage', ['closed_won', 'closed_lost']);
                });
            } else {
                $stage = $request->stage;
                $query->whereHas('opportunities', function($oppQ) use ($stage) {
                    $oppQ->where('stage', $stage);
                });
            }
        }

        // Call Outcome filter
        if ($request->filled('call_outcome') && $request->call_outcome !== 'all') {
            if ($request->call_outcome === 'deal') {
                $query->has('opportunities');
            } elseif ($request->call_outcome === 'uncontacted') {
                $query->whereDoesntHave('activities', function($actQ) {
                    $actQ->where('type', 'call');
                })->whereDoesntHave('opportunities.activities', function($actQ) {
                    $actQ->where('type', 'call');
                });
            } elseif ($request->call_outcome === 'Not Interested') {
                $query->where(function($q) {
                    $q->whereHas('activities', function($actQ) {
                        $actQ->where('type', 'call')->where('call_outcome', 'like', '%Not Interested%');
                    })->orWhereHas('opportunities.activities', function($actQ) {
                        $actQ->where('type', 'call')->where('call_outcome', 'like', '%Not Interested%');
                    });
                });
            } elseif ($request->call_outcome === 'Interested') {
                $query->where(function($q) {
                    $q->whereHas('activities', function($actQ) {
                        $actQ->where('type', 'call')
                             ->where(function($sub) {
                                 $sub->where('call_outcome', 'like', '%Interested%')
                                     ->orWhere('call_outcome', 'like', '%Viewing%')
                                     ->orWhere('call_outcome', 'like', '%Meeting%');
                             })
                             ->where('call_outcome', 'not like', '%Not Interested%');
                    })->orWhereHas('opportunities.activities', function($actQ) {
                        $actQ->where('type', 'call')
                             ->where(function($sub) {
                                 $sub->where('call_outcome', 'like', '%Interested%')
                                     ->orWhere('call_outcome', 'like', '%Viewing%')
                                     ->orWhere('call_outcome', 'like', '%Meeting%');
                             })
                             ->where('call_outcome', 'not like', '%Not Interested%');
                    });
                });
            } else {
                $outcome = $request->call_outcome;
                $query->where(function($q) use ($outcome) {
                    $q->whereHas('activities', function($actQ) use ($outcome) {
                        $actQ->where('type', 'call')->where('call_outcome', 'like', "%{$outcome}%");
                    })->orWhereHas('opportunities.activities', function($actQ) use ($outcome) {
                        $actQ->where('type', 'call')->where('call_outcome', 'like', "%{$outcome}%");
                    });
                });
            }
        }

        // Lead Type filter (Paid / Organic)
        if ($request->filled('lead_type') && $request->lead_type !== 'all') {
            $query->where('contacts.lead_type', $request->lead_type);
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

        $sortBy = $request->get('sort_by');
        $sortOrder = strtolower($request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';

        // 1. Direct Contact Columns
        $contactDirectMap = [
            'name' => 'name',
            'phone' => 'phone',
            'secondary_phone' => 'secondary_phone',
            'email' => 'email',
            'nationality' => 'nationality',
            'source' => 'source',
            'lead_type' => 'lead_type',
            'state' => 'state',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ];

        // 2. Direct Opportunity Columns
        $oppDirectMap = [
            'opportunity' => 'stage',
            'stage' => 'stage',
            'opportunity_type' => 'opportunity_type',
            'budget_min' => 'budget_min',
            'budget_max' => 'budget_max',
            'key_requirement' => 'key_requirement',
            'next_action' => 'next_action',
            'next_action_due_at' => 'next_action_due_at',
            'sla' => 'sla_status',
            'sla_status' => 'sla_status',
        ];

        // 3. Buyer Qualifications Property Specs Columns
        $buyerQualMap = [
            'developer' => 'developer',
            'community' => 'community',
            'project' => 'project',
            'project_property' => 'project_property',
            'bedrooms' => 'bedrooms',
            'cash_or_finance' => 'cash_or_finance',
        ];

        if (!empty($sortBy) && isset($contactDirectMap[$sortBy])) {
            $col = $contactDirectMap[$sortBy];
            $query->orderBy("contacts.{$col}", $sortOrder);
        } elseif ($sortBy === 'assigned_owner') {
            $query->orderByRaw("COALESCE(NULLIF(contacts.assigned_to, 'Unassigned'), '') {$sortOrder}");
        } elseif ($sortBy === 'sub_source') {
            $query->orderByRaw("COALESCE(contacts.utm_source, contacts.source, '') {$sortOrder}");
        } elseif ($sortBy === 'utm_campaign') {
            $query->orderByRaw("COALESCE(contacts.utm_campaign, '') {$sortOrder}");
        } elseif ($sortBy === 'call_status') {
            $query->orderBy(
                Activity::select('call_outcome')
                    ->whereColumn('activities.contact_id', 'contacts.id')
                    ->where('type', 'call')
                    ->latest('id')
                    ->limit(1),
                $sortOrder
            );
        } elseif (!empty($sortBy) && isset($oppDirectMap[$sortBy])) {
            $oppCol = $oppDirectMap[$sortBy];
            $query->orderBy(
                Opportunity::select($oppCol)
                    ->whereColumn('opportunities.contact_id', 'contacts.id')
                    ->latest('id')
                    ->limit(1),
                $sortOrder
            );
        } elseif (!empty($sortBy) && isset($buyerQualMap[$sortBy])) {
            $bqCol = $buyerQualMap[$sortBy];
            $query->orderBy(
                BuyerQualification::select("buyer_qualifications.{$bqCol}")
                    ->join('opportunities', 'opportunities.id', '=', 'buyer_qualifications.opportunity_id')
                    ->whereColumn('opportunities.contact_id', 'contacts.id')
                    ->latest('buyer_qualifications.id')
                    ->limit(1),
                $sortOrder
            );
        } else {
            // Default Sort: Created Date latest first
            $query->orderBy('contacts.created_at', 'desc');
        }

        $query->orderBy('contacts.id', 'desc');

        $perPage = max(1, min((int) $request->get('per_page', 20), 500));
        $contacts = $query->paginate($perPage);

        // Stats calculation for Top KPI Cards & Tab Badge Counts
        $isLeadsDesk = $request->boolean('leads_desk');
        $isInboundOnly = $request->boolean('inbound_only') || $request->get('source_type') === 'inbound';
        $isImportedOnly = $request->boolean('imported_only') || $request->get('source_type') === 'imported';
        $baseCountQuery = Contact::query();
        if ($isLeadsDesk) {
            $baseCountQuery->where(function ($q) {
                $q->where('is_imported', false)
                  ->orWhereNull('is_imported')
                  ->orWhere(function ($sub) {
                      $sub->where('is_imported', true)
                          ->whereNotNull('assigned_to')
                          ->where('assigned_to', '!=', '')
                          ->where('assigned_to', '!=', 'Unassigned');
                  });
            });
        } elseif ($isInboundOnly) {
            $baseCountQuery->where('is_imported', false);
        } elseif ($isImportedOnly) {
            $baseCountQuery->where('is_imported', true);
        }
        if ($targetOwner !== null) {
            if ($targetOwner === 'unassigned') {
                $baseCountQuery->where(function($q) {
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
                });
            } else {
                $baseCountQuery->where(function($q) use ($targetOwner) {
                    $q->where('assigned_to', $targetOwner)
                      ->orWhereHas('opportunities', function($oppQ) use ($targetOwner) {
                          $oppQ->where('current_owner_name', $targetOwner);
                      });
                });
            }
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

        $newUncontactedQuery = (clone $baseCountQuery)
            ->whereDoesntHave('activities', function($actQ) {
                $actQ->where('type', 'call');
            })->whereDoesntHave('opportunities.activities', function($actQ) {
                $actQ->where('type', 'call');
            });
        if (!$isLeadsDesk && !$isImportedOnly) {
            $newUncontactedQuery->where('is_imported', false);
        }
        $newUncontactedCount = $newUncontactedQuery->count();

        $contactedCount = (clone $baseCountQuery)->where(function($q) {
            $q->whereHas('activities', function($actQ) {
                $actQ->where('type', 'call');
            })->orWhereHas('opportunities.activities', function($actQ) {
                $actQ->where('type', 'call');
            });
        })->count();

        $contactedTodayCount = (clone $baseCountQuery)->where(function($q) {
            $q->whereHas('activities', function($actQ) {
                $actQ->where('type', 'call')->whereDate('created_at', now()->toDateString());
            })->orWhereHas('opportunities.activities', function($actQ) {
                $actQ->where('type', 'call')->whereDate('created_at', now()->toDateString());
            });
        })->count();

        $overdueCount = (clone $baseCountQuery)->where(function($q) {
            $q->where(function($cq) {
                $cq->where('contacts.sla_status', 'overdue')
                   ->orWhere(function($sub) {
                       $sub->whereNotNull('contacts.next_action_due_at')
                           ->where('contacts.next_action_due_at', '<', now());
                   });
            })->orWhereHas('opportunities', function($oppQ) {
                $oppQ->where('sla_status', 'overdue')
                     ->orWhere(function($sub) {
                         $sub->whereNotNull('next_action_due_at')
                             ->where('next_action_due_at', '<', now());
                     });
            });
        })->count();

        $stats = [
            'total' => (clone $baseCountQuery)->count(),
            'available' => (clone $baseCountQuery)->where('state', 'available')->count(),
            'active' => (clone $baseCountQuery)->where('state', 'active')->count(),
            'reactivation' => (clone $baseCountQuery)->where('state', 'reactivation')->count(),
            'duplicates' => (clone $baseCountQuery)->where('state', 'duplicate')->count(),
            'new_leads' => $newUncontactedCount,
            'contacted' => $contactedCount,
            'contacted_today' => $contactedTodayCount,
            'overdue' => $overdueCount,
            'unassigned' => $unassignedCount,
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

        $deletedQuery = Contact::onlyTrashed();
        if ($isLeadsDesk) {
            $deletedQuery->where(function ($q) {
                $q->where('is_imported', false)
                  ->orWhereNull('is_imported')
                  ->orWhere(function ($sub) {
                      $sub->where('is_imported', true)
                          ->whereNotNull('assigned_to')
                          ->where('assigned_to', '!=', '')
                          ->where('assigned_to', '!=', 'Unassigned');
                  });
            });
        } elseif ($isInboundOnly) {
            $deletedQuery->where('is_imported', false);
        } elseif ($isImportedOnly) {
            $deletedQuery->where('is_imported', true);
        }
        if ($targetOwner !== null && $targetOwner !== 'unassigned') {
            $deletedQuery->where(function($q) use ($targetOwner) {
                $q->where('assigned_to', $targetOwner)
                  ->orWhereHas('opportunities', function($oppQ) use ($targetOwner) {
                      $oppQ->where('current_owner_name', $targetOwner);
                  });
            });
        }
        $deletedCount = $deletedQuery->count();

        $tabCounts = [
            'all' => (clone $baseCountQuery)->count(),
            'unassigned' => $unassignedCount,
            'new' => $newUncontactedCount,
            'contacted' => $contactedCount,
            'overdue' => $overdueCount,
            'assigned' => $assignedCount,
            'duplicate' => (clone $baseCountQuery)->where('state', 'duplicate')->count(),
            'opportunities' => (clone $baseCountQuery)->whereHas('opportunities')->count(),
            'deleted' => $deletedCount,
        ];

        return response()->json([
            'contacts' => $contacts,
            'stats' => $stats,
            'tab_counts' => $tabCounts,
        ]);
    }

    public function show($id)
    {
        $contact = Contact::withTrashed()
            ->with([
                'opportunities.buyerQualification',
                'opportunities.sellerQualification',
                'opportunities.landlordQualification',
                'opportunities.tenantQualification',
                'opportunities.activities' => function ($q) {
                    $q->latest();
                },
                'activities' => function ($q) {
                    $q->latest();
                },
            ])
            ->findOrFail($id);

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

        // Auto-map aliases for key requirement from external webhooks / n8n
        if (!$request->filled('key_requirement')) {
            $keyReqAlias = $request->input('notes') 
                ?? $request->input('specific_notes') 
                ?? $request->input('requirement') 
                ?? $request->input('requirements')
                ?? $request->input('comments') 
                ?? $request->input('comment');
            if (!empty($keyReqAlias)) {
                $request->merge(['key_requirement' => $keyReqAlias]);
            }
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:50',
            'secondary_phone' => 'nullable|string|max:255',
            'email' => 'required|email|max:255',
            'nationality' => 'nullable|string|max:100',
            'emirates_id' => 'nullable|string|max:100',
            'source' => 'nullable|string|max:100',
            'sub_source' => 'nullable|string|max:100',
            'lead_type' => 'nullable|string|max:50',
            'traffic_type' => 'nullable|string|max:50',
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

        $rawSource = $validated['source'] ?? 'Database';
        if ($request->filled('sub_source')) {
            $subSource = trim($request->input('sub_source'));
            if (!empty($subSource) && !str_contains($rawSource, '(')) {
                $rawSource = "{$rawSource} ({$subSource})";
            }
        }
        $validated['source'] = $rawSource;

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

        $rawLeadType = $request->input('lead_type') 
            ?? $request->input('traffic_type') 
            ?? $request->input('paid_organic') 
            ?? $request->input('lead_category')
            ?? $request->input('type');

        $leadType = 'Organic';
        if ($rawLeadType) {
            $ltLower = strtolower(trim($rawLeadType));
            if (str_contains($ltLower, 'paid')) {
                $leadType = 'Paid';
            } elseif (str_contains($ltLower, 'organic')) {
                $leadType = 'Organic';
            } else {
                $leadType = ucfirst(trim($rawLeadType));
            }
        } else {
            // Auto-detect if source or utm indicates paid
            $srcCombined = strtolower(($validated['source'] ?? '') . ' ' . ($validated['utm_medium'] ?? '') . ' ' . ($validated['utm_source'] ?? ''));
            if (str_contains($srcCombined, 'paid') || str_contains($srcCombined, 'cpc') || str_contains($srcCombined, 'meta') || str_contains($srcCombined, 'facebook ads') || str_contains($srcCombined, 'google ads')) {
                $leadType = 'Paid';
            }
        }

        $contactData = [
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'secondary_phone' => $validated['secondary_phone'] ?? null,
            'email' => $validated['email'],
            'nationality' => !empty($validated['nationality']) ? $validated['nationality'] : 'Expat / UAE Resident',
            'emirates_id' => $validated['emirates_id'] ?? null,
            'source' => $validated['source'],
            'lead_type' => $leadType,
            'initials' => $validated['initials'],
            'utm_source' => $validated['utm_source'] ?? ($request->input('sub_source') ?: null),
            'utm_medium' => $validated['utm_medium'] ?? null,
            'utm_campaign' => $validated['utm_campaign'] ?? null,
            'utm_term' => $validated['utm_term'] ?? null,
            'utm_content' => $validated['utm_content'] ?? null,
            'landing_page_url' => $validated['landing_page_url'] ?? ($validated['campaign_url'] ?? null),
            'is_imported' => false,
            'state' => $validated['state'],
        ];

        $contact = Contact::create($contactData);

        if ($contact->state !== 'duplicate') {
            // Lead Distribution: Assign directly if specific advisor explicitly provided
            $assignedOwner = $request->input('assigned_owner');
            if (!empty($assignedOwner) && $assignedOwner !== 'auto' && $assignedOwner !== 'Unassigned') {
                $contact->update([
                    'assigned_to' => $assignedOwner,
                    'assigned_at' => now(),
                    'state'       => 'assigned',
                ]);
            } else {
                // Dynamic Lead Distribution according to Master Settings scope
                $settings = LeadDistributionService::getSettings();
                if ($settings->is_enabled && $settings->apply_to_lead_pool) {
                    LeadDistributionService::autoAssignContact($contact, 'lead_pool');
                    $contact->refresh();
                }
            }
        }

        // Preserve initial inquiry preferences & key requirement as an audit activity note
        $rawKeyReq = $request->input('key_requirement');

        $inquiryDetails = [];
        if ($request->filled('developer')) $inquiryDetails[] = "Developer: {$request->developer}";
        if ($request->filled('community')) $inquiryDetails[] = "Location/Community: {$request->community}";
        if ($request->filled('project')) $inquiryDetails[] = "Project: {$request->project}";
        if ($request->filled('project_property')) $inquiryDetails[] = "Unit: {$request->project_property}";
        if ($request->filled('property_type')) $inquiryDetails[] = "Property Type: {$request->property_type}";
        if ($request->filled('bedrooms')) $inquiryDetails[] = "Beds: {$request->bedrooms}";
        if ($request->filled('budget_min') || $request->filled('budget_max')) {
            $inquiryDetails[] = "Budget: AED " . ($request->budget_min ?: '0') . " – " . ($request->budget_max ?: 'Max');
        }
        if (!empty($rawKeyReq)) {
            $inquiryDetails[] = "Notes: {$rawKeyReq}";
        }

        if (!empty($inquiryDetails)) {
            Activity::create([
                'contact_id'  => $contact->id,
                'user_name'   => 'Lead Engine',
                'type'        => 'note',
                'description' => 'Initial Inquiry Requirements: ' . implode(' | ', $inquiryDetails),
            ]);
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
            'sub_source' => 'nullable|string|max:100',
            'assigned_to' => 'nullable|string|max:100',
            'assigned_owner' => 'nullable|string|max:100',
            'utm_source' => 'nullable|string|max:255',
            'utm_medium' => 'nullable|string|max:255',
            'utm_campaign' => 'nullable|string|max:255',
            'utm_term' => 'nullable|string|max:255',
            'utm_content' => 'nullable|string|max:255',
            'landing_page_url' => 'nullable|string|max:2048',
            'campaign_url' => 'nullable|string|max:2048',
            'lead_type' => 'nullable|string|max:50',
            'traffic_type' => 'nullable|string|max:50',
        ]);

        if ($request->has('lead_type') || $request->has('traffic_type')) {
            $rawLt = $request->input('lead_type') ?? $request->input('traffic_type');
            if (!empty($rawLt)) {
                $validated['lead_type'] = str_contains(strtolower($rawLt), 'paid') ? 'Paid' : 'Organic';
            }
        }

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

        if ($request->filled('sub_source')) {
            $subSource = trim($request->input('sub_source'));
            $rawSource = $request->input('source', $contact->source ?? 'Database');
            if (!empty($subSource) && !str_contains($rawSource, '(')) {
                $validated['source'] = "{$rawSource} ({$subSource})";
            }
        }

        $newOwner = $request->input('assigned_owner') ?? $request->input('assigned_to');
        if (!empty($newOwner) && $newOwner !== 'Unassigned' && $newOwner !== 'auto') {
            if ($contact->assigned_to !== $newOwner) {
                $assignedBy = $request->input('assigned_by') ?? ($request->user()?->name ?? 'Admin');
                Activity::create([
                    'contact_id'  => $contact->id,
                    'user_name'   => $assignedBy,
                    'type'        => 'ownership_change',
                    'description' => "Lead assigned to {$newOwner} by {$assignedBy}.",
                ]);
            }
            $validated['assigned_to'] = $newOwner;
            $validated['assigned_at'] = now();
            $validated['state'] = 'assigned';
        } elseif ($newOwner === 'auto') {
            LeadDistributionService::autoAssignContact($contact);
        }
        unset($validated['assigned_owner']);

        $contact->update($validated);

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

        $assignedBy = $request->input('assigned_by') ?? ($request->user()?->name ?? 'Admin');
        foreach ($ids as $cid) {
            Activity::create([
                'contact_id'  => $cid,
                'user_name'   => $assignedBy,
                'type'        => 'ownership_change',
                'description' => "Lead assigned to {$owner} by {$assignedBy}.",
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => count($ids) . " leads successfully assigned to {$owner}.",
        ]);
    }

    public function reassign(Request $request, $id)
    {
        $request->validate([
            'assigned_owner' => 'required|string|max:255',
        ]);

        $contact = Contact::findOrFail($id);
        $newOwner = $request->input('assigned_owner');
        $oldOwner = $contact->assigned_to ?: 'Unassigned';
        $assignedBy = $request->input('assigned_by') ?? ($request->user()?->name ?? 'Admin');

        $contact->update([
            'assigned_to' => $newOwner,
            'assigned_at' => now(),
            'state'       => 'assigned',
        ]);

        // Update all associated opportunities
        Opportunity::where('contact_id', $contact->id)->update([
            'current_owner_name' => $newOwner,
        ]);

        // Record ownership change log
        Activity::create([
            'contact_id'  => $contact->id,
            'user_name'   => $assignedBy,
            'type'        => 'ownership_change',
            'description' => "Lead re-assigned from {$oldOwner} to {$newOwner} by {$assignedBy}.",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Lead successfully re-assigned to {$newOwner}.",
            'contact' => $contact->fresh(['opportunities.buyerQualification', 'activities']),
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

    /**
     * Get upcoming follow-up SLA alerts (due within 10 minutes or overdue)
     */
    public function upcomingAlerts(Request $request)
    {
        $now = Carbon::now();
        $inTenMinutes = $now->copy()->addMinutes(10);
        $user = $request->user();
        $userName = $user ? $user->name : null;

        // Synchronize overdue status in database for past due dates
        Opportunity::whereNotNull('next_action_due_at')
            ->where('next_action_due_at', '<', $now)
            ->where('sla_status', '!=', 'overdue')
            ->update(['sla_status' => 'overdue']);

        Contact::whereNotNull('next_action_due_at')
            ->where('next_action_due_at', '<', $now)
            ->where('sla_status', '!=', 'overdue')
            ->update(['sla_status' => 'overdue']);

        $isSuper = $user && ($user->role === 'superadmin' || $user->role === 'admin' || $user->role === 'manager' || !empty($user->is_super_user));

        // 1. Opportunities with scheduled follow-ups
        $oppQuery = Opportunity::with(['contact'])
            ->whereNotNull('next_action_due_at')
            ->whereNotIn('stage', ['closed_won', 'closed_lost'])
            ->where(function ($q) use ($now, $inTenMinutes) {
                // Due within next 10 minutes OR overdue within past 48 hours
                $q->whereBetween('next_action_due_at', [$now, $inTenMinutes])
                  ->orWhere(function ($sub) use ($now) {
                      $sub->where('next_action_due_at', '<', $now)
                          ->where('next_action_due_at', '>=', $now->copy()->subHours(48));
                  });
            });

        if (!$isSuper && !empty($userName)) {
            $oppQuery->where(function ($q) use ($userName) {
                $q->where('current_owner_name', $userName)
                  ->orWhereHas('contact', function ($cq) use ($userName) {
                      $cq->where('assigned_to', $userName);
                  });
            });
        }

        $opportunities = $oppQuery->orderBy('next_action_due_at', 'asc')->limit(20)->get();

        // 2. Contacts with scheduled follow-ups (pre-deal / no deal created yet)
        $contactQuery = Contact::whereNotNull('next_action_due_at')
            ->where(function ($q) use ($now, $inTenMinutes) {
                // Due within next 10 minutes OR overdue within past 48 hours
                $q->whereBetween('next_action_due_at', [$now, $inTenMinutes])
                  ->orWhere(function ($sub) use ($now) {
                      $sub->where('next_action_due_at', '<', $now)
                          ->where('next_action_due_at', '>=', $now->copy()->subHours(48));
                  });
            });

        if (!$isSuper && !empty($userName)) {
            $contactQuery->where(function ($q) use ($userName) {
                $q->where('assigned_to', $userName)
                  ->orWhereNull('assigned_to')
                  ->orWhere('assigned_to', 'Unassigned');
            });
        }

        $contactFollowUps = $contactQuery->orderBy('next_action_due_at', 'asc')->limit(20)->get();

        // Avoid duplicating if contact already has an opportunity in $opportunities
        $coveredContactIds = $opportunities->pluck('contact_id')->filter()->all();
        $filteredContacts = $contactFollowUps->reject(function ($c) use ($coveredContactIds) {
            return in_array($c->id, $coveredContactIds);
        });

        $alerts = collect();

        foreach ($opportunities as $opp) {
            $dueAt = Carbon::parse($opp->next_action_due_at);
            $isOverdue = $dueAt->isPast();
            $diffMinutes = abs((int) $dueAt->diffInMinutes($now));

            $alerts->push([
                'id' => 'opp_' . $opp->id,
                'opportunity_id' => $opp->id,
                'contact_id' => $opp->contact_id,
                'contact' => $opp->contact,
                'client_name' => $opp->contact ? $opp->contact->name : 'Client',
                'phone' => $opp->contact ? $opp->contact->phone : '',
                'assigned_owner' => $opp->current_owner_name ?: ($opp->contact ? $opp->contact->assigned_to : 'Unassigned'),
                'next_action' => $opp->next_action ?: 'Follow-up Call',
                'next_action_due_at' => $opp->next_action_due_at,
                'is_overdue' => $isOverdue,
                'diff_minutes' => $diffMinutes,
                'sla_status' => $opp->sla_status,
                'status_label' => $isOverdue ? "Overdue by {$diffMinutes}m" : "Due in {$diffMinutes}m",
            ]);
        }

        foreach ($filteredContacts as $c) {
            $dueAt = Carbon::parse($c->next_action_due_at);
            $isOverdue = $dueAt->isPast();
            $diffMinutes = abs((int) $dueAt->diffInMinutes($now));

            $alerts->push([
                'id' => 'ct_' . $c->id,
                'opportunity_id' => null,
                'contact_id' => $c->id,
                'contact' => $c,
                'client_name' => $c->name ?: 'Client',
                'phone' => $c->phone ?: '',
                'assigned_owner' => $c->assigned_to ?: 'Unassigned',
                'next_action' => $c->next_action ?: 'Follow-up Call',
                'next_action_due_at' => $c->next_action_due_at,
                'is_overdue' => $isOverdue,
                'diff_minutes' => $diffMinutes,
                'sla_status' => $c->sla_status,
                'status_label' => $isOverdue ? "Overdue by {$diffMinutes}m" : "Due in {$diffMinutes}m",
            ]);
        }

        $sortedAlerts = $alerts->sortBy(function ($item) {
            return Carbon::parse($item['next_action_due_at'])->timestamp;
        })->values();

        return response()->json([
            'alerts' => $sortedAlerts,
            'count' => $sortedAlerts->count(),
            'server_time' => $now->toIso8601String(),
        ]);
    }

    /**
     * Snooze/Postpone follow-up by specified minutes (default 10)
     */
    public function snoozeFollowUp(Request $request, $id)
    {
        $validated = $request->validate([
            'minutes' => 'nullable|integer|min:1|max:1440',
            'notes' => 'nullable|string',
        ]);

        $minutes = (int) ($validated['minutes'] ?? 10);
        $contact = Contact::findOrFail($id);
        $user = $request->user();
        $userName = $user ? $user->name : 'Agent';

        $opp = Opportunity::where('contact_id', $contact->id)->latest()->first();
        $now = Carbon::now();
        $newDue = $now->copy()->addMinutes($minutes);

        if ($opp) {
            if ($opp->next_action_due_at && Carbon::parse($opp->next_action_due_at)->isFuture()) {
                $newDue = Carbon::parse($opp->next_action_due_at)->addMinutes($minutes);
            }
            $opp->next_action_due_at = $newDue;
            $opp->sla_status = 'due_soon';
            $opp->is_orphaned = false;
            $opp->save();
        }

        if ($contact->next_action_due_at && Carbon::parse($contact->next_action_due_at)->isFuture()) {
            $newDue = Carbon::parse($contact->next_action_due_at)->addMinutes($minutes);
        }
        $contact->next_action_due_at = $newDue;
        $contact->sla_status = 'due_soon';
        $contact->save();

        Activity::create([
            'contact_id' => $contact->id,
            'opportunity_id' => $opp ? $opp->id : null,
            'user_name' => $userName,
            'type' => 'note',
            'description' => "Follow-up postponed/snoozed by {$minutes} minutes by {$userName}." . (!empty($validated['notes']) ? " Note: {$validated['notes']}" : ""),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Follow-up postponed by {$minutes} minutes.",
            'next_action_due_at' => $newDue->toIso8601String(),
            'sla_status' => 'due_soon',
            'contact' => $contact,
            'opportunity' => $opp,
        ]);
    }
}
