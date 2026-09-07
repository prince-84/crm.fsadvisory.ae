<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class EmailSettingsController extends Controller
{
    /**
     * Get the active email & SMTP configuration
     */
    public function getEmailSettings()
    {
        $settings = EmailSetting::current();

        $data = $settings->toArray();
        // Mask password for security
        $data['mail_password_masked'] = !empty($settings->mail_password) ? '••••••••••••' : '';
        $data['has_password'] = !empty($settings->mail_password);
        unset($data['mail_password']); // Do not expose raw password in GET

        return response()->json([
            'success'  => true,
            'settings' => $data,
        ]);
    }

    /**
     * Update email & SMTP configuration
     */
    public function saveEmailSettings(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'mail_host'         => 'required|string|max:255',
            'mail_port'         => 'required|integer|min:1|max:65535',
            'mail_scheme'       => 'nullable|string|in:smtps,tls,ssl,null,',
            'mail_username'     => 'required|string|max:255',
            'mail_password'     => 'nullable|string',
            'mail_from_address' => 'required|email|max:255',
            'mail_from_name'    => 'required|string|max:255',
            'default_domain'    => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        $settings = EmailSetting::current();

        $updateData = [
            'mail_host'         => $request->input('mail_host'),
            'mail_port'         => (int) $request->input('mail_port'),
            'mail_scheme'       => $request->input('mail_scheme') ?: null,
            'mail_username'     => $request->input('mail_username'),
            'mail_from_address' => $request->input('mail_from_address'),
            'mail_from_name'    => $request->input('mail_from_name'),
            'default_domain'    => $request->input('default_domain', 'fsadvisory.ae'),
            'is_active'         => true,
        ];

        // Only update password if a new one was provided (not empty and not masked placeholder)
        $newPassword = $request->input('mail_password');
        if (!empty($newPassword) && !str_starts_with($newPassword, '•••')) {
            $updateData['mail_password'] = $newPassword;
        }

        $settings->update($updateData);
        $settings->applyToRuntimeConfig();

        return response()->json([
            'success' => true,
            'message' => 'Email & SMTP server settings updated successfully!',
            'settings' => $settings->fresh(),
        ]);
    }

    /**
     * Dispatch a real live test email to verify SMTP connection
     */
    public function sendTestEmail(Request $request)
    {
        $request->validate([
            'recipient_email' => 'required|email',
        ]);

        $recipient = $request->input('recipient_email');
        $settings = EmailSetting::current();
        $settings->applyToRuntimeConfig();

        try {
            Mail::raw(
                "Hello,\n\nThis is a test email dispatched from FS Advisory Real Estate CRM to verify your SMTP server configuration.\n\n" .
                "• Host: {$settings->mail_host}\n" .
                "• Port: {$settings->mail_port}\n" .
                "• Encryption: " . ($settings->mail_scheme ?: 'None') . "\n" .
                "• From: {$settings->mail_from_address}\n" .
                "• Official Domain: {$settings->default_domain}\n\n" .
                "Timestamp: " . now()->toDateTimeString() . " GST\n\n" .
                "— FS Advisory CRM Telecommunications & Mail Gateway",
                function ($message) use ($recipient, $settings) {
                    $message->to($recipient)
                            ->from($settings->mail_from_address, $settings->mail_from_name)
                            ->subject("FS Advisory CRM — SMTP Connection Test Verification");
                }
            );

            return response()->json([
                'success' => true,
                'message' => "Test email successfully dispatched to {$recipient} via {$settings->mail_host}:{$settings->mail_port}!",
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => "SMTP Delivery Failed: " . $e->getMessage(),
            ], 500);
        }
    }
}
