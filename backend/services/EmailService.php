<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

final class EmailService
{
    private const ESSENTIAL_TYPES = [
        'otp_verification',
        'account_created',
        'account_status',
        'account_access_updated',
        'password_change_required',
    ];

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
        return $this->dispatch(
            $email,
            $name,
            $subject,
            $body,
            'otp_verification',
            'A one-time verification code was sent. The code is never stored in the delivery log.',
            false
        );
    }

    public function sendNotification(string $email, string $name, string $subject, string $message, string $type): array
    {
        $safeName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeSubject = htmlspecialchars($subject, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
        $body = $this->wrapTemplate(
            "<p>Hi <strong>{$safeName}</strong>,</p><h3 style=\"color:#e2e8f0\">{$safeSubject}</h3><p style=\"color:#cbd5e1;line-height:1.6\">{$safeMessage}</p>"
        );
        return $this->dispatch($email, $name, $subject, $body, $type, $message, true);
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

    public function retryNotification(string $notificationId): array
    {
        if (!$this->enhancedNotificationsAvailable()) {
            throw new RuntimeException('Enhanced notification delivery is not available until database migration 005 is applied.');
        }
        $statement = $this->pdo->prepare(
            "SELECT notification_id, recipient_email, COALESCE(recipient_name, recipient_email) AS recipient_name,
                    notification_type, subject, message_text, delivery_status, retry_count
             FROM notifications WHERE notification_id = ? LIMIT 1"
        );
        $statement->execute([$notificationId]);
        $notification = $statement->fetch();
        if (!$notification) {
            throw new RuntimeException('Email delivery record not found.');
        }
        if ($notification['delivery_status'] !== 'failed') {
            throw new RuntimeException('Only failed email deliveries can be retried.');
        }
        if ($notification['notification_type'] === 'otp_verification') {
            throw new RuntimeException('Verification-code emails cannot be retried. Send a new verification code instead.');
        }
        if ((int) $notification['retry_count'] >= 5) {
            throw new RuntimeException('This email has reached the maximum of five manual retries.');
        }

        $safeName = htmlspecialchars((string) $notification['recipient_name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeSubject = htmlspecialchars((string) $notification['subject'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeMessage = nl2br(htmlspecialchars((string) $notification['message_text'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
        $body = $this->wrapTemplate(
            "<p>Hi <strong>{$safeName}</strong>,</p><h3 style=\"color:#e2e8f0\">{$safeSubject}</h3><p style=\"color:#cbd5e1;line-height:1.6\">{$safeMessage}</p>"
        );
        $update = $this->pdo->prepare(
            "UPDATE notifications
             SET delivery_status = 'queued', failure_reason = NULL,
                 retry_count = retry_count + 1, last_attempt_at = UTC_TIMESTAMP()
             WHERE notification_id = ?"
        );
        $update->execute([$notificationId]);
        return $this->deliverExisting(
            $notificationId,
            (string) $notification['recipient_email'],
            (string) $notification['recipient_name'],
            (string) $notification['subject'],
            $body
        );
    }

    private function dispatch(
        string $email,
        string $name,
        string $subject,
        string $bodyHtml,
        string $type,
        string $logMessage,
        bool $allowInApp
    ): array
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid notification recipient.');
        }

        $email = strtolower($email);
        $notificationId = uuid_v4();
        $enhanced = $this->enhancedNotificationsAvailable();
        $category = $this->categoryForType($type);
        $recipient = $enhanced ? $this->recipientForEmail($email) : null;
        $essential = in_array($type, self::ESSENTIAL_TYPES, true);
        $preferences = $this->deliveryPreferences($recipient['id'] ?? null, $category, $essential);
        $emailEnabled = $preferences['email'];
        $inAppVisible = $allowInApp && ($recipient['id'] ?? '') !== '' && $preferences['inApp'];

        if ($enhanced) {
            $status = $emailEnabled ? 'queued' : 'suppressed';
            $insert = $this->pdo->prepare(
                'INSERT INTO notifications
                 (notification_id, recipient_user_id, recipient_email, recipient_name,
                  notification_type, notification_category, subject, message_text,
                  delivery_status, in_app_visible, last_attempt_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([
                $notificationId,
                $recipient['id'] ?? null,
                $email,
                $name,
                $type,
                $category,
                $subject,
                $logMessage,
                $status,
                $inAppVisible ? 1 : 0,
                $emailEnabled ? gmdate('Y-m-d H:i:s') : null,
            ]);
        } else {
            $insert = $this->pdo->prepare(
                "INSERT INTO notifications
                 (notification_id, recipient_email, notification_type, subject, message_text, delivery_status)
                 VALUES (?, ?, ?, ?, ?, 'queued')"
            );
            $insert->execute([$notificationId, $email, $type, $subject, $logMessage]);
        }

        if (!$emailEnabled) {
            return ['success' => true, 'suppressed' => true, 'notificationId' => $notificationId];
        }

        return $this->deliverExisting($notificationId, $email, $name, $subject, $bodyHtml);
    }

    private function deliverExisting(
        string $notificationId,
        string $email,
        string $name,
        string $subject,
        string $bodyHtml
    ): array {

        if ($this->apiKey === '') {
            $this->markFailed($notificationId, 'Email provider is not configured.');
            return ['success' => false, 'notificationId' => $notificationId];
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
            "UPDATE notifications
             SET delivery_status = 'sent', provider_message_id = ?, failure_reason = NULL,
                 sent_at = UTC_TIMESTAMP()
             WHERE notification_id = ?"
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

    private function enhancedNotificationsAvailable(): bool
    {
        return database_has_columns($this->pdo, 'notifications', [
            'recipient_name', 'notification_category', 'in_app_visible', 'read_at',
            'retry_count', 'last_attempt_at',
        ]) && database_has_columns($this->pdo, 'notification_preferences', [
            'user_id', 'notification_category', 'email_enabled', 'in_app_enabled',
        ]);
    }

    private function recipientForEmail(string $email): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT user_id AS id, full_name AS name FROM users WHERE email = ? LIMIT 1'
        );
        $statement->execute([$email]);
        $recipient = $statement->fetch();
        return $recipient ?: null;
    }

    private function deliveryPreferences(?string $userId, string $category, bool $essential): array
    {
        if ($essential || !$userId || !$this->enhancedNotificationsAvailable()) {
            return ['email' => true, 'inApp' => true];
        }
        $statement = $this->pdo->prepare(
            'SELECT email_enabled, in_app_enabled FROM notification_preferences
             WHERE user_id = ? AND notification_category = ? LIMIT 1'
        );
        $statement->execute([$userId, $category]);
        $row = $statement->fetch();
        return [
            'email' => $row ? (bool) $row['email_enabled'] : true,
            'inApp' => $row ? (bool) $row['in_app_enabled'] : true,
        ];
    }

    private function categoryForType(string $type): string
    {
        return match ($type) {
            'account_created', 'account_status', 'account_access_updated',
            'password_change_required', 'otp_verification' => 'account',
            'announcement_broadcast' => 'announcements',
            'payment_update', 'dues_reminder' => 'payments',
            'reservation_update' => 'reservations',
            'concern_update' => 'concerns',
            'vehicle_update', 'sticker_update' => 'records',
            default => 'general',
        };
    }
}
