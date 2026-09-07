<?php

namespace App\Mail;

use App\Models\Opportunity;
use App\Models\EmailSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OpportunityEmailMailable extends Mailable
{
    use Queueable, SerializesModels;

    public Opportunity $opportunity;
    public string $clientName;
    public string $emailSubject;
    public string $emailBody;
    public string $agentName;
    public string $agentEmail;
    public ?string $agentPhone;
    public array $propertyDetails;
    public array $uploadedAttachments;

    /**
     * Create a new message instance.
     */
    public function __construct(
        Opportunity $opportunity,
        string $clientName,
        string $emailSubject,
        string $emailBody,
        string $agentName,
        string $agentEmail,
        ?string $agentPhone = null,
        array $propertyDetails = [],
        array $uploadedAttachments = []
    ) {
        $this->opportunity = $opportunity;
        $this->clientName = $clientName;
        $this->emailSubject = $emailSubject;
        $this->emailBody = $emailBody;
        $this->agentName = $agentName;
        $this->agentEmail = $agentEmail;
        $this->agentPhone = $agentPhone;
        $this->propertyDetails = $propertyDetails;
        $this->uploadedAttachments = $uploadedAttachments;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $settings = EmailSetting::current();
        $fromAddress = $settings->mail_from_address ?: 'notifications@crm.fsadvisory.ae';
        $fromName = "{$this->agentName} — FS Advisory Dubai";

        return new Envelope(
            from: new Address($fromAddress, $fromName),
            replyTo: [new Address($this->agentEmail, "{$this->agentName} — FS Advisory")],
            subject: $this->emailSubject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.opportunity_proposal',
            with: [
                'opportunity'     => $this->opportunity,
                'clientName'      => $this->clientName,
                'emailSubject'    => $this->emailSubject,
                'emailBody'       => $this->emailBody,
                'agentName'       => $this->agentName,
                'agentEmail'      => $this->agentEmail,
                'agentPhone'      => $this->agentPhone,
                'propertyDetails' => $this->propertyDetails,
            ],
        );
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        $mailAttachments = [];
        foreach ($this->uploadedAttachments as $att) {
            if (!empty($att['path']) && file_exists($att['path'])) {
                $mailAttachments[] = Attachment::fromPath($att['path'])
                    ->as($att['name'] ?? basename($att['path']))
                    ->withMime($att['mime'] ?? 'application/pdf');
            }
        }
        return $mailAttachments;
    }
}
