<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

final class EmailService
{
    private PDO $pdo;
    private string $fromEmail;
    private string $apiKey;
    private string $fromName = 'Novaville Homeowners Association, Inc.';

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? requireDbConnection();
        $this->fromEmail = (string) config_value('SYSTEM_EMAIL', 'NOVALINK_SYSTEM_EMAIL', 'mail@novalinkhub.tech');
        $this->apiKey = (string) config_value('BREVO_API_KEY', 'NOVALINK_BREVO_API_KEY', '');
    }

    public function sendOtpEmail(string $email, string $name, string $code, string $purpose): array
    {
        $safeName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safePurpose = htmlspecialchars($purpose, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeCode = htmlspecialchars($code, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $subject = "NovaLink verification code - {$purpose}";
        $body = $this->wrapTemplate(
            "<p>Hi <strong>{$safeName}</strong>,</p>
             <p>Your verification code for <strong>{$safePurpose}</strong> is:</p>
             <div style=\"background:#1e293b;border:1px solid #334155;padding:20px;text-align:center;border-radius:12px;font-size:28px;font-weight:bold;letter-spacing:4px;color:#60a5fa;margin:20px 0\">{$safeCode}</div>
             <p style=\"font-size:12px;color:#94a3b8\">This code expires in 15 minutes and can be attempted at most five times. If you did not request it, ignore this email.</p>"
        );
        return $this->dispatch($email, $name, $subject, $body, 'otp_verification');
    }

    public function sendNotification(string $email, string $name, string $subject, string $message, string $type): array
    {
        $safeName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeSubject = htmlspecialchars($subject, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
        $body = $this->wrapTemplate(
            "<p>Hi <strong>{$safeName}</strong>,</p><h3 style=\"color:#e2e8f0\">{$safeSubject}</h3><p style=\"color:#cbd5e1;line-height:1.6\">{$safeMessage}</p>"
        );
        return $this->dispatch($email, $name, $subject, $body, $type);
    }

    public function sendAnnouncementBroadcast(string $email, string $name, string $title, string $content): array
    {
        return $this->sendNotification($email, $name, 'NHAI Announcement: ' . $title, $content, 'announcement_broadcast');
    }

    private function wrapTemplate(string $content): string
    {
        return '<div style="font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:30px">'
            . '<h2 style="color:#3b82f6">Novaville Homeowners Association, Inc.</h2>'
            . $content
            . '<hr style="border:0;border-top:1px solid #334155;margin:20px 0">'
            . '<p style="font-size:11px;color:#64748b">NovaLink HOA Management Portal</p></div>';
    }

    private function dispatch(string $email, string $name, string $subject, string $bodyHtml, string $type): array
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid notification recipient.');
        }

        $notificationId = uuid_v4();
        $insert = $this->pdo->prepare(
            "INSERT INTO notifications
             (notification_id, recipient_email, notification_type, subject, message_text, delivery_status)
             VALUES (?, ?, ?, ?, ?, 'queued')"
        );
        $insert->execute([$notificationId, strtolower($email), $type, $subject, strip_tags($bodyHtml)]);

        if ($this->apiKey === '') {
            $this->markFailed($notificationId, 'Email provider is not configured.');
            throw new RuntimeException('Email service is not configured.');
        }

        $payload = [
            'sender' => ['name' => $this->fromName, 'email' => $this->fromEmail],
            'to' => [['email' => strtolower($email), 'name' => $name]],
            'subject' => $subject,
            'htmlContent' => $bodyHtml,
        ];

        $handle = curl_init('https://api.brevo.com/v3/smtp/email');
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => [
                'accept: application/json',
                'api-key: ' . $this->apiKey,
                'content-type: application/json',
            ],
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
        ]);

        $response = curl_exec($handle);
        $httpCode = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $transportError = curl_error($handle);
        curl_close($handle);
        $decoded = is_string($response) ? json_decode($response, true) : null;

        if ($httpCode < 200 || $httpCode >= 300) {
            $reason = $transportError !== '' ? $transportError : (string) ($decoded['message'] ?? "Provider returned HTTP {$httpCode}");
            $this->markFailed($notificationId, $reason);
            return ['success' => false, 'notificationId' => $notificationId];
        }

        $providerId = (string) ($decoded['messageId'] ?? '');
        $update = $this->pdo->prepare(
            "UPDATE notifications SET delivery_status = 'sent', provider_message_id = ?, sent_at = UTC_TIMESTAMP() WHERE notification_id = ?"
        );
        $update->execute([$providerId !== '' ? $providerId : null, $notificationId]);
        return ['success' => true, 'notificationId' => $notificationId, 'providerMessageId' => $providerId];
    }

    private function markFailed(string $notificationId, string $reason): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE notifications SET delivery_status = 'failed', failure_reason = ? WHERE notification_id = ?"
        );
        $statement->execute([mb_substr($reason, 0, 255), $notificationId]);
    }
}
