<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\QueueController;
use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SlaController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\LeadSourceController;
use App\Http\Controllers\Api\MasterCatalogController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\CallRecordingController;
use App\Http\Controllers\Api\WhatsAppController;
use App\Http\Controllers\Api\OwnerDataController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LeadDistributionController;

// Auth routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::get('/auth/me', [AuthController::class, 'me']);

// User & Permissions routes
Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::put('/users/{id}', [UserController::class, 'update']);
Route::delete('/users/{id}', [UserController::class, 'destroy']);
Route::put('/users/{id}/permissions', [UserController::class, 'updatePermissions']);
Route::post('/users/{id}/activate', [UserController::class, 'activate']);

// Role Management & Permissions Matrix
Route::get('/roles', [RoleController::class, 'index']);
Route::post('/roles', [RoleController::class, 'store']);
Route::put('/roles/{id}', [RoleController::class, 'update']);
Route::delete('/roles/{id}', [RoleController::class, 'destroy']);
Route::get('/permissions/matrix', [RoleController::class, 'permissionsMatrix']);

Route::get('/contacts', [ContactController::class, 'index']);
Route::post('/contacts', [ContactController::class, 'store']);
Route::post('/contacts/bulk-assign', [ContactController::class, 'bulkAssign']);
Route::post('/contacts/bulk-delete', [ContactController::class, 'bulkDelete']);
Route::post('/contacts/import-preview', [ImportController::class, 'preview']);
Route::post('/contacts/import-execute', [ImportController::class, 'execute']);
Route::get('/contacts/{id}', [ContactController::class, 'show']);
Route::put('/contacts/{id}', [ContactController::class, 'update']);
Route::delete('/contacts/{id}', [ContactController::class, 'destroy']);
Route::post('/contacts/{id}/restore', [ContactController::class, 'restore']);
Route::delete('/contacts/{id}/force', [ContactController::class, 'forceDelete']);

Route::get('/queue', [QueueController::class, 'index']);

Route::get('/opportunities', [OpportunityController::class, 'index']);
Route::post('/opportunities', [OpportunityController::class, 'store']);
Route::get('/opportunities/{id}', [OpportunityController::class, 'show']);
Route::put('/opportunities/{id}', [OpportunityController::class, 'update']);
Route::post('/opportunities/{id}/update', [OpportunityController::class, 'update']);
Route::delete('/opportunities/{id}', [OpportunityController::class, 'destroy']);
Route::post('/opportunities/{id}/qualify', [OpportunityController::class, 'qualify']);
Route::post('/opportunities/{id}/qualify-seller', [OpportunityController::class, 'qualifySeller']);
Route::post('/opportunities/{id}/qualify-landlord', [OpportunityController::class, 'qualifyLandlord']);
Route::post('/opportunities/{id}/qualify-tenant', [OpportunityController::class, 'qualifyTenant']);
Route::post('/opportunities/{id}/handover', [OpportunityController::class, 'handover']);
Route::put('/opportunities/{id}/stage', [OpportunityController::class, 'updateStage']);
Route::post('/opportunities/{id}/release-to-bank', [OpportunityController::class, 'releaseToBank']);

Route::get('/activities', [ActivityController::class, 'index']);
Route::post('/activities', [ActivityController::class, 'store']);

Route::get('/recordings', [CallRecordingController::class, 'index']);
Route::post('/recordings/sync-3cx', [CallRecordingController::class, 'sync3cx']);
Route::post('/recordings/{id}/attach-audio', [CallRecordingController::class, 'attachAudio']);
Route::any('/3cx/lookup', [CallRecordingController::class, 'contactLookup']);
Route::post('/3cx/call-event', [CallRecordingController::class, 'handle3cxWebhook']);
Route::post('/3cx/webhook', [CallRecordingController::class, 'handle3cxWebhook']);
Route::post('/3cx/upload-recording', [CallRecordingController::class, 'uploadRecording']);
Route::post('/3cx/import-csv', [CallRecordingController::class, 'import3cxCsv']);

// WhatsApp Wazzup-Style Integration Routes
Route::get('/whatsapp/channels', [WhatsAppController::class, 'channels']);
Route::post('/whatsapp/channels/generate-qr', [WhatsAppController::class, 'generateQr']);
Route::post('/whatsapp/channels/{id}/pair-confirm', [WhatsAppController::class, 'pairConfirm']);
Route::post('/whatsapp/channels/{id}/disconnect', [WhatsAppController::class, 'disconnect']);
Route::post('/whatsapp/sync-phone-data', [WhatsAppController::class, 'syncPhoneData']);
Route::get('/whatsapp/chats', [WhatsAppController::class, 'chats']);
Route::get('/whatsapp/chats/{id}/messages', [WhatsAppController::class, 'getChatMessages']);
Route::post('/whatsapp/chats/{id}/send', [WhatsAppController::class, 'sendMessage']);
Route::post('/whatsapp/chats/{id}/update-contact-info', [WhatsAppController::class, 'updateContactInfo']);
Route::post('/whatsapp/chats/{id}/simulate-incoming', [WhatsAppController::class, 'simulateIncoming']);
Route::post('/whatsapp/webhook', [WhatsAppController::class, 'webhook']);

Route::get('/reports/analytics', [ReportController::class, 'analytics']);
Route::post('/sla/check-escalations', [SlaController::class, 'checkEscalations']);

Route::get('/portals', [PortalController::class, 'index']);
Route::post('/portals/ingest', [PortalController::class, 'ingest']);

Route::post('/opportunities/{id}/ai-predict', [AiController::class, 'predict']);

Route::get('/settings', [SettingsController::class, 'getSettings']);
Route::post('/settings', [SettingsController::class, 'saveSettings']);

// Lead Sources & Sub-Sources CRUD
Route::get('/lead-sources', [LeadSourceController::class, 'index']);
Route::post('/lead-sources', [LeadSourceController::class, 'store']);
Route::put('/lead-sources/{id}', [LeadSourceController::class, 'update']);
Route::delete('/lead-sources/{id}', [LeadSourceController::class, 'destroy']);

Route::post('/lead-sources/{sourceId}/sub-sources', [LeadSourceController::class, 'storeSubSource']);
Route::put('/lead-sub-sources/{id}', [LeadSourceController::class, 'updateSubSource']);
Route::delete('/lead-sub-sources/{id}', [LeadSourceController::class, 'destroySubSource']);

// Master Catalogs CRUD (Developers, Projects, Property Types, Communities)
Route::get('/catalog/developers', [MasterCatalogController::class, 'getDevelopers']);
Route::post('/catalog/developers', [MasterCatalogController::class, 'storeDeveloper']);
Route::put('/catalog/developers/{id}', [MasterCatalogController::class, 'updateDeveloper']);
Route::delete('/catalog/developers/{id}', [MasterCatalogController::class, 'destroyDeveloper']);

Route::get('/catalog/projects', [MasterCatalogController::class, 'getProjects']);
Route::post('/catalog/projects', [MasterCatalogController::class, 'storeProject']);
Route::put('/catalog/projects/{id}', [MasterCatalogController::class, 'updateProject']);
Route::delete('/catalog/projects/{id}', [MasterCatalogController::class, 'destroyProject']);

Route::get('/catalog/properties', [MasterCatalogController::class, 'getPropertyTypes']);
Route::post('/catalog/properties', [MasterCatalogController::class, 'storePropertyType']);
Route::put('/catalog/properties/{id}', [MasterCatalogController::class, 'updatePropertyType']);
Route::delete('/catalog/properties/{id}', [MasterCatalogController::class, 'destroyPropertyType']);

Route::get('/catalog/communities', [MasterCatalogController::class, 'getCommunities']);
Route::post('/catalog/communities', [MasterCatalogController::class, 'storeCommunity']);
Route::put('/catalog/communities/{id}', [MasterCatalogController::class, 'updateCommunity']);
Route::delete('/catalog/communities/{id}', [MasterCatalogController::class, 'destroyCommunity']);

Route::get('/catalog/opportunity-types', [MasterCatalogController::class, 'getOpportunityTypes']);
Route::post('/catalog/opportunity-types', [MasterCatalogController::class, 'storeOpportunityType']);
Route::put('/catalog/opportunity-types/{id}', [MasterCatalogController::class, 'updateOpportunityType']);
Route::delete('/catalog/opportunity-types/{id}', [MasterCatalogController::class, 'destroyOpportunityType']);

// Owner Data CRUD Routes
Route::get('/owner-data', [OwnerDataController::class, 'index']);
Route::post('/owner-data', [OwnerDataController::class, 'store']);
Route::post('/owner-data/bulk-delete', [OwnerDataController::class, 'bulkDelete']);
Route::post('/owner-data/import', [OwnerDataController::class, 'import']);
Route::get('/owner-data/{id}', [OwnerDataController::class, 'show']);
Route::put('/owner-data/{id}', [OwnerDataController::class, 'update']);
Route::delete('/owner-data/{id}', [OwnerDataController::class, 'destroy']);
Route::post('/owner-data/{id}/restore', [OwnerDataController::class, 'restore']);

// Performance Reports & Analytics Routes
Route::get('/reports/team-performance', [ReportController::class, 'teamPerformance']);
Route::get('/reports/analytics', [ReportController::class, 'analytics']);

// Lead Distribution & Dynamic Auto-Assignment
Route::get('/distribution/settings', [LeadDistributionController::class, 'getSettings']);
Route::put('/distribution/settings', [LeadDistributionController::class, 'updateSettings']);
Route::get('/distribution/logs', [LeadDistributionController::class, 'getLogs']);
Route::delete('/distribution/logs', [LeadDistributionController::class, 'clearLogs']);
Route::post('/distribution/agent/{id}/toggle', [LeadDistributionController::class, 'toggleAgentPool']);
Route::post('/distribution/agent/{id}/config', [LeadDistributionController::class, 'updateAgentConfig']);
Route::post('/distribution/run/lead-pool', [LeadDistributionController::class, 'runLeadPoolDistribution']);
Route::post('/distribution/run/owner-data', [LeadDistributionController::class, 'runOwnerDataDistribution']);
Route::post('/distribution/reset-counters', [LeadDistributionController::class, 'resetTodayCounters']);

